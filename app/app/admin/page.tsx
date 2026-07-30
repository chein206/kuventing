// 시크릿 없이 /admin 으로 들어온 경우. 존재 여부만 알려주고 아무것도 열지 않는다.
export default function AdminIndex() {
  return (
    <div className="app">
      <div className="state">
        <div className="ic">🔒</div>
        <h2>접근할 수 없습니다</h2>
        <p>주소가 올바르지 않습니다.</p>
      </div>
    </div>
  );
}
