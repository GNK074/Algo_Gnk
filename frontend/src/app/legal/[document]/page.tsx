import Link from 'next/link';
import { notFound } from 'next/navigation';

const documents = {
  terms: ['Terms of Service', 'GNK Algo provides account registration and security management. You are responsible for protecting access to your account and for providing accurate registration information.'],
  privacy: ['Privacy Policy', 'GNK Algo uses your name, email address and mobile number to administer your account. We use email to verify ownership and support password recovery. Authentication records help protect your account.'],
  risk: ['Risk Disclaimer', 'Financial markets involve risks, including potential loss of capital. GNK Algo account registration does not activate trading or brokerage services. This application does not provide investment recommendations or guarantee financial returns.'],
  security: ['Security Awareness', 'Never share your password, authenticator codes or recovery codes. Check the website address before entering your credentials.'],
  cookies: ['Cookie Notice', 'The application uses browser session storage to remember that the homepage disclaimer has been displayed during your browsing session.'],
} as const;

export function generateStaticParams() {
  return Object.keys(documents).map(document => ({ document }));
}

export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!Object.hasOwn(documents, document)) notFound();
  const [title, content] = documents[document as keyof typeof documents];
  return <main className="panel"><Link href="/">GNK Algo</Link><h1>{title}</h1><p>Draft for pre-release review</p><p>{content}</p></main>;
}
