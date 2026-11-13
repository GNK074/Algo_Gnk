import Link from 'next/link';
import AccountForm from '../account-form';

export default function Login() {
  return <main className="panel"><Link href="/">GNK Algo</Link><h1>Log in</h1><AccountForm /><p><Link href="/forgot-password">Forgot password?</Link></p><p><Link href="/resend-verification">Resend verification email</Link></p><Link href="/register">Create account</Link></main>;
}
