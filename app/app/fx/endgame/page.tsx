import type { Metadata } from 'next';
import { BUILD } from '@/lib/build';
import EndgameDemo from './EndgameDemo';
import '../../board/[token]/board.css';
import '../../board/[token]/motion-ad.css';
import './endgame.css';

// 끝물 데모 — 실제 카운터 화면을 메모리 판으로 돌려, 끝물 방식 4가지가 화면에서 어떻게 넘어가는지 본다.
// 가짜 판이라 DB 에 아무것도 쓰지 않는다. 테마는 ?theme= (dark-west · dark-east · light-west · photo-letterpress …),
// 글꼴은 ?font= (system · myeongjo · gothic · pretendard · dodum), 여는 손잡이는 ?grip= (paper 기본 · knob)
export const metadata: Metadata = { title: '쿠벤팅 끝물 데모' };

export default async function EndgamePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const q = await searchParams;
  const theme = typeof q.theme === 'string' ? q.theme : 'dark-west';
  const font = typeof q.font === 'string' ? q.font : 'system';
  const grip = q.grip === 'knob' ? 'knob' : 'paper';
  return <EndgameDemo theme={theme} font={font} grip={grip} build={BUILD} />;
}
