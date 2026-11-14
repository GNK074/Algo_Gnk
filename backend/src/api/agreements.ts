import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, Headers, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { AccountController, database, sendAccountMail } from './accounts';

const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
type Response = { setHeader(name: string, value: string): void; send(value: Buffer): void };

async function addText(pdf: PDFDocument, text: string) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage();
  let y = 790;
  for (const line of text.split(/\r?\n/)) {
    let part = '';
    const draw = () => {
      if (y < 45) { page = pdf.addPage(); y = 790; }
      if (part) page.drawText(part, { x: 42, y, font, size: 10 });
      y -= 15;
      part = '';
    };
    for (const character of line) {
      if (font.widthOfTextAtSize(part + character, 10) > 500) draw();
      part += character;
    }
    draw();
  }
}

@Controller('api/agreements')
export class AgreementController {
  constructor(private readonly accounts: AccountController) {}

  private async user(cookie?: string) {
    return (await this.accounts.requireSession(cookie)).user;
  }

  private async admin(cookie?: string) {
    const user = await this.user(cookie);
    if (user.id !== process.env.GNK_AGREEMENT_ADMIN_ID) throw new ForbiddenException();
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Headers('cookie') cookie?: string) {
    const user = await this.user(cookie);
    const versions = await database.agreementVersion.findMany({
      where: { publishedAt: { not: null }, archivedAt: null },
      select: { id: true, title: true, version: true, format: true, sha256: true },
    });
    const accepted = await database.agreementAcceptance.findMany({
      where: { userId: user.id },
      select: { id: true, versionId: true, acceptedAt: true, sha256: true, version: { select: { title: true, version: true } } },
    });
    return { versions, accepted, admin: user.id === process.env.GNK_AGREEMENT_ADMIN_ID };
  }

  @Post('admin/create')
  @Header('Cache-Control', 'no-store')
  async create(@Body() body: { title?: string; format?: string; content?: string }, @Headers('cookie') cookie?: string) {
    await this.admin(cookie);
    if (typeof body?.title !== 'string' || !body.title.trim() || body.title.length > 200 ||
        typeof body.content !== 'string' || !body.content.trim() || body.content.length > 60_000 ||
        (body.format !== 'text' && body.format !== 'pdf')) throw new BadRequestException('Invalid agreement.');
    const source = Buffer.from(body.content, body.format === 'pdf' ? 'base64' : 'utf8');
    try {
      if (body.format === 'pdf') await PDFDocument.load(source);
      else await addText(await PDFDocument.create(), body.content);
    } catch {
      throw new BadRequestException('The document cannot be processed.');
    }
    const slug = 'software-services';
    const latest = await database.agreementVersion.aggregate({ where: { slug }, _max: { version: true } });
    return database.agreementVersion.create({
      data: { slug, version: (latest._max.version ?? 0) + 1, title: body.title.trim(), format: body.format, source, sha256: hash(source) },
      select: { id: true, version: true },
    });
  }

  @Get('admin/history')
  @Header('Cache-Control', 'no-store')
  async history(@Headers('cookie') cookie?: string) {
    await this.admin(cookie);
    return {
      versions: await database.agreementVersion.findMany({ orderBy: { version: 'desc' }, select: { id: true, title: true, version: true, publishedAt: true, archivedAt: true } }),
      accepted: await database.agreementAcceptance.findMany({ take: 100, orderBy: { acceptedAt: 'desc' }, select: { id: true, versionId: true, acceptedAt: true, sha256: true, user: { select: { email: true } } } }),
    };
  }

  @Post('admin/:id/publish')
  @Header('Cache-Control', 'no-store')
  async publish(@Param('id') id: string, @Headers('cookie') cookie?: string) {
    await this.admin(cookie);
    if (!uuid.test(id)) throw new NotFoundException();
    await database.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "AgreementVersion" IN SHARE ROW EXCLUSIVE MODE`;
      const version = await tx.agreementVersion.findUnique({ where: { id } });
      if (!version || version.publishedAt) throw new BadRequestException('Select an unpublished version.');
      const now = new Date();
      await tx.agreementVersion.updateMany({ where: { slug: version.slug, publishedAt: { not: null }, archivedAt: null }, data: { archivedAt: now } });
      await tx.agreementVersion.update({ where: { id }, data: { publishedAt: now } });
    });
    return { status: 'published' };
  }

  @Get(':id/source')
  @Header('Cache-Control', 'no-store')
  async source(@Param('id') id: string, @Headers('cookie') cookie: string, @Res() response: Response) {
    const user = await this.user(cookie);
    if (!uuid.test(id)) throw new NotFoundException();
    const record = await database.agreementVersion.findFirst({ where: { id, publishedAt: { not: null }, OR: [{ archivedAt: null }, { acceptances: { some: { userId: user.id } } }] } });
    if (!record) throw new NotFoundException();
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', 'attachment; filename="agreement.' + (record.format === 'pdf' ? 'pdf' : 'txt') + '"');
    response.setHeader('Content-Type', 'application/octet-stream');
    response.send(Buffer.from(record.source));
  }

  @Post(':id/accept')
  @Header('Cache-Control', 'no-store')
  async accept(@Param('id') id: string, @Body() body: { accepted?: boolean; sha256?: string }, @Headers('cookie') cookie?: string) {
    const user = await this.user(cookie);
    if (!uuid.test(id) || body?.accepted !== true) throw new BadRequestException('Explicit agreement is required.');
    const record = await database.agreementVersion.findFirst({ where: { id, publishedAt: { not: null }, archivedAt: null } });
    if (!record || body.sha256 !== record.sha256) throw new BadRequestException('Reload the current agreement.');
    const acceptedAt = new Date();
    const acceptanceId = randomUUID();
    const pdf = record.format === 'pdf' ? await PDFDocument.load(Uint8Array.from(record.source)) : await PDFDocument.create();
    if (record.format === 'text') await addText(pdf, Buffer.from(record.source).toString('utf8'));
    await addText(pdf, [
      'Electronic Acceptance Certificate', 'Receipt: ' + acceptanceId, 'Account: ' + user.id,
      'Agreement version: ' + record.version, 'Source SHA-256: ' + record.sha256,
      'Accepted at (UTC): ' + acceptedAt.toISOString(),
      'The authenticated account explicitly acknowledged this agreement.',
    ].join('\n'));
    const document = await pdf.save();
    const inserted = await database.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "AgreementVersion" IN ACCESS SHARE MODE`;
      const current = await tx.agreementVersion.findFirst({ where: { id, publishedAt: { not: null }, archivedAt: null } });
      if (!current) throw new BadRequestException('Reload the current agreement.');
      return tx.agreementAcceptance.createMany({
        skipDuplicates: true,
        data: { id: acceptanceId, userId: user.id, versionId: id, acceptedAt, document: Uint8Array.from(document), sha256: hash(document) },
      });
    });
    if (!inserted.count) return { status: 'already_accepted' };
    const attempt = await database.agreementDelivery.create({ data: { acceptanceId } });
    try {
      await sendAccountMail(user.email, 'GNK Algo agreement confirmation', 'Your accepted agreement and electronic acceptance certificate are attached.', document);
      await database.agreementDelivery.update({ where: { id: attempt.id }, data: { sentAt: new Date() } });
    } catch {
      return { status: 'accepted', emailSent: false };
    }
    return { status: 'accepted', emailSent: true };
  }

  @Post(':id/resend-email')
  async resend(@Param('id') id: string, @Headers('cookie') cookie?: string) {
    const user = await this.user(cookie);
    if (!uuid.test(id)) throw new NotFoundException();
    const delivery = await database.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "AgreementAcceptance" WHERE id = ${id}::uuid AND "userId" = ${user.id}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException();
      const recent = await tx.agreementDelivery.findFirst({ where: { acceptanceId: id, attemptedAt: { gt: new Date(Date.now() - 300_000) } } });
      if (recent) throw new BadRequestException('Wait five minutes between email attempts.');
      return tx.agreementDelivery.create({ data: { acceptanceId: id }, include: { acceptance: { select: { document: true } } } });
    });
    try {
      await sendAccountMail(user.email, 'GNK Algo agreement confirmation', 'Your accepted agreement is attached.', delivery.acceptance.document);
    } catch {
      return { emailSent: false };
    }
    await database.agreementDelivery.update({ where: { id: delivery.id }, data: { sentAt: new Date() } });
    return { emailSent: true };
  }

  @Get(':id/download')
  @Header('Cache-Control', 'no-store')
  async download(@Param('id') id: string, @Headers('cookie') cookie: string, @Res() response: Response) {
    const user = await this.user(cookie);
    if (!uuid.test(id)) throw new NotFoundException();
    const record = await database.agreementAcceptance.findFirst({ where: { id, userId: user.id } });
    if (!record) throw new NotFoundException();
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', 'attachment; filename="accepted-agreement.pdf"');
    response.setHeader('Content-Type', 'application/pdf');
    response.send(Buffer.from(record.document));
  }
}
