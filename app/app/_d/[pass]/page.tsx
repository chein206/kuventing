import DrawClient from './DrawClient';

// QR이 가리키는 주소: /d/<뽑기권코드>
export default async function Page({ params }: { params: Promise<{ pass: string }> }) {
  const { pass } = await params;
  return <DrawClient pass={pass} />;
}
