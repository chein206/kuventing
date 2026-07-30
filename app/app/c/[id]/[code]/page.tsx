import CouponClient from './CouponClient';

// 손님이 보드 결과 화면의 QR을 찍으면 오는 곳
export default async function Page({
  params,
}: { params: Promise<{ id: string; code: string }> }) {
  const { id, code } = await params;
  return <CouponClient campaignId={id} code={code} />;
}
