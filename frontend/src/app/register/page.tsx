import Link from 'next/link';
import AccountForm from '../../components/account-form';

export default function Register() {
  return <main className="panel"><Link href="/">GNK Algo</Link><h1>Create your account</h1><AccountForm register /><Link href="/login">Already have an account? Log in</Link></main>;
}
