// 서버 기동 시 백그라운드 시세 수집기 시작
// 방문자가 없어도 차트/등락률용 이력이 쌓이도록 60초마다 점검
// (getPriceTable은 캐시 주기 내에는 바로템을 다시 호출하지 않으므로
//  실제 바로템 조회 빈도는 관리자 설정 주기를 따름)

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getPriceTable } = await import("@/lib/barotem");

  const tick = () => {
    getPriceTable().catch(() => {
      // 수집 실패는 다음 주기에 재시도
    });
  };
  tick();
  setInterval(tick, 60 * 1000);
}
