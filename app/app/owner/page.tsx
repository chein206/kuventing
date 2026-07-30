// 토큰 없이 /owner 로 들어온 경우. 여기서는 아무것도 열어주지 않는다.
export default function OwnerIndex() {
  return (
    <div className="app">
      <div className="state">
        <div className="ic">🔑</div>
        <h2>매장 주소가 필요합니다</h2>
        <p>
          사장님 화면은 매장마다 주소가 다릅니다.<br />
          전달받은 링크로 들어와 주세요.
        </p>
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          <code>/owner/&lt;매장코드&gt;</code>
        </p>
      </div>
    </div>
  );
}
