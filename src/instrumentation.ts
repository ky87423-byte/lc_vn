// 서버 기동 시 백그라운드 시세 수집기 시작
// 방문자가 없어도 차트/등락률용 이력이 쌓이도록 60초마다 점검
// (getPriceTable은 캐시 주기 내에는 바로템을 다시 호출하지 않으므로
//  실제 바로템 조회 빈도는 관리자 설정 주기를 따름)

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getPriceTable } = await import("@/lib/barotem");
  const { collectItembay } = await import("@/lib/itembay");
  const { GAMES } = await import("@/data/site");

  const tick = async () => {
    // 게임별 순차 수집 — 거래소에 동시 부하를 주지 않도록
    for (const game of GAMES) {
      try {
        await getPriceTable(game); // 바로템
      } catch {
        // 수집 실패는 다음 주기에 재시도
      }
      try {
        await collectItembay(game); // 아이템베이(설정된 게임만, 자체 주기 게이트)
      } catch {
        // 거래소별 실패 격리 — 다른 거래소·게임 수집에 영향 없음
      }
    }
  };
  void tick();
  setInterval(() => void tick(), 60 * 1000);
}
