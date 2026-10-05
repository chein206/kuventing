import FxClient from './FxClient';
import '../board/[token]/board.css';
import './fx.css';

// 결과 화면 미리보기. 테마와 판을 바꿔 가며 실제 화면 그대로 본다. 가짜 데이터라 표가 줄지 않는다.
export const metadata = { title: '쿠벤팅 결과 미리보기' };

export default async function FxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : null);
  return <FxClient theme={one('theme')} tier={one('tier')} bare={one('bare') === '1'} view={one('view')} />;
}
