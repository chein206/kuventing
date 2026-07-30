// 토큰 없이 /board 로 들어온 경우.
export default function BoardIndex() {
  return (
    <div className="app">
      <div className="state">
        <div className="ic">🎫</div>
        <h2>카운터 화면 주소가 필요합니다</h2>
        <p>
          매장마다 주소가 다릅니다.<br />
          사장님 화면에서 카운터 화면 주소를 확인하세요.
        </p>
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          <code>/board/&lt;보드코드&gt;</code>
        </p>
      </div>
    </div>
  );
}
