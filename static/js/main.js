document.addEventListener('DOMContentLoaded', function() {
    // 전역 변수
    let stockData = [];
    let currentWeek = 0;
    let totalPnl = 0;
    let tradeHistory = [];
    let stockChart = null;
    let pnlChart = null;  // PnL 차트 변수 추가
    let gameInfo = {
        ticker: 'Unknown'
        // 날짜 정보 제거 (하드코딩으로 대체)
    };
    
    // DOM 요소
    const longBtn = document.getElementById('longBtn');
    const neutralBtn = document.getElementById('neutralBtn');
    const shortBtn = document.getElementById('shortBtn');
    const weeklyPnlElement = document.getElementById('weeklyPnl');
    const totalPnlElement = document.getElementById('totalPnl');
    const currentWeekElement = document.getElementById('currentWeek');
    const historyTableBody = document.getElementById('historyTable').querySelector('tbody');
    const gameOverModal = document.getElementById('gameOverModal');
    const finalPnlElement = document.getElementById('finalPnl');
    const restartBtn = document.getElementById('restartBtn');
    const headerRestartBtn = document.getElementById('headerRestartBtn'); // 새로 추가된 버튼
    const shareBtn = document.getElementById('shareBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    // 게임 초기화
    initGame();
    
    // 버튼 이벤트 리스너
    longBtn.addEventListener('click', () => submitTrade('long'));
    neutralBtn.addEventListener('click', () => submitTrade('neutral'));
    shortBtn.addEventListener('click', () => submitTrade('short'));
    restartBtn.addEventListener('click', restartGame);
    headerRestartBtn.addEventListener('click', restartGameWithConfirm); // 새로운 이벤트 리스너
    shareBtn.addEventListener('click', shareResults);
    closeModalBtn.addEventListener('click', closeGameOverModal);
    
    // 게임 상태 저장 함수
    function saveGameState() {
        const gameState = {
            ticker: gameInfo.ticker
        };
        localStorage.setItem('gameState', JSON.stringify(gameState));
        console.log("게임 상태 저장:", gameState);
    }
    
    // 게임 상태 로드 함수
    function loadGameState() {
        try {
            const savedState = localStorage.getItem('gameState');
            if (savedState) {
                return JSON.parse(savedState);
            }
        } catch (e) {
            console.error("게임 상태 로드 실패:", e);
        }
        return null;
    }
    
    // 게임 초기화 함수
    function initGame() {
        console.log("게임 초기화 시작...");
        
        // 로컬 스토리지에서 이전 게임의 ticker 확인
        const savedState = loadGameState();
        const savedTicker = savedState ? savedState.ticker : null;
        
        // ticker 파라미터 추가
        const url = savedTicker ? 
            `/api/stock-data?ticker=${encodeURIComponent(savedTicker)}` : 
            '/api/stock-data';
        
        fetch(url)
            .then(response => {
                console.log("서버 응답 상태:", response.status);
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `서버 응답 오류: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(response => {
                console.log("데이터 수신 성공:", response);
                
                if (!response.data || response.data.length === 0) {
                    console.error("빈 데이터 수신");
                    throw new Error("서버에서 빈 데이터를 반환했습니다");
                }
                
                stockData = response.data;
                gameInfo.ticker = response.ticker;
                
                // 게임 상태 저장 (ticker 정보)
                saveGameState();
                
                currentWeek = 16;  // 16주차부터 시작
                totalPnl = 0;
                tradeHistory = [];
                
                updateWeekDisplay();
                renderChart();
                initPnlChart();
                updatePnlDisplay(0);
                clearHistoryTable();
                
                enableTradeButtons();
                
                // 게임 정보 업데이트
                updateGameInfo();
            })
            .catch(error => {
                console.error('Error fetching stock data:', error);
                alert(`주식 데이터를 불러오는 데 실패했습니다: ${error.message}\n\n데이터 폴더에 CSV 파일이 있는지 확인해주세요.`);
                disableTradeButtons();
            });
    }
    
    // 게임 정보 업데이트
    function updateGameInfo() {
        const tickerElement = document.getElementById('gameTicker');
        if (tickerElement) {
            tickerElement.textContent = gameInfo.ticker;
        }
    }
    
    // PnL 차트 초기화 함수 - 성능 최적화 및 모든 글씨 제거
    function initPnlChart() {
        const ctx = document.getElementById('pnlChart').getContext('2d');
        
        // 이전 차트 제거
        if (pnlChart) {
            pnlChart.destroy();
        }
        
        // 초기 데이터 (시작점)
        const labels = ['주차 16'];
        const data = [0];
        
        // 차트 생성 - 성능 최적화
        pnlChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '누적 수익률 (%)',
                    data: data,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: true,
                    pointRadius: 2, // 포인트 크기 줄임
                    pointHoverRadius: 4, // 호버 시 포인트 크기 줄임
                    borderWidth: 1.5 // 선 두께 줄임
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 150 // 애니메이션 시간 대폭 줄임
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        display: false, // y축 숨김
                        beginAtZero: false,
                        grid: {
                            display: false // 그리드 숨김
                        }
                    },
                    x: {
                        display: false, // x축 숨김
                        grid: {
                            display: false // 그리드 숨김
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // 범례 숨김
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `수익률: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // PnL 차트 업데이트 함수 - 성능 최적화
    function updatePnlChart(week, pnl) {
        // 차트가 없으면 초기화
        if (!pnlChart) {
            initPnlChart();
            return;
        }
        
        // 주차 라벨 추가
        pnlChart.data.labels.push(`주차 ${week}`);
        
        // 누적 PnL 데이터 추가
        pnlChart.data.datasets[0].data.push(pnl);
        
        // 데이터에 따라 선 색상 변경
        if (pnl >= 0) {
            pnlChart.data.datasets[0].borderColor = 'rgba(75, 192, 192, 1)';
            pnlChart.data.datasets[0].backgroundColor = 'rgba(75, 192, 192, 0.2)';
        } else {
            pnlChart.data.datasets[0].borderColor = 'rgba(255, 99, 132, 1)';
            pnlChart.data.datasets[0].backgroundColor = 'rgba(255, 99, 132, 0.2)';
        }
        
        // 차트 업데이트 - 애니메이션 없이 빠르게 업데이트
        pnlChart.update('none');
    }
    
    // 클라이언트 측 샘플 데이터 생성 함수
    function generateSampleData() {
        return new Promise((resolve) => {
            const result = [];
            let basePrice = 100.0;
            
            for (let i = 0; i < 32; i++) {
                const openPrice = basePrice * (1 + (Math.random() * 0.1 - 0.05));
                const closePrice = openPrice * (1 + (Math.random() * 0.2 - 0.1));
                const highPrice = Math.max(openPrice, closePrice) * (1 + Math.random() * 0.05);
                const lowPrice = Math.min(openPrice, closePrice) * (1 - Math.random() * 0.05);
                
                result.push({
                    date: `Week ${i+1}`,
                    open: parseFloat(openPrice.toFixed(2)),
                    high: parseFloat(highPrice.toFixed(2)),
                    low: parseFloat(lowPrice.toFixed(2)),
                    close: parseFloat(closePrice.toFixed(2))
                });
                
                basePrice = closePrice;
            }
            
            resolve(result);
        });
    }
    
    // 주가 차트 렌더링 함수 수정
    function renderChart() {
        const ctx = document.getElementById('stockChart').getContext('2d');
        
        // 이전 차트 제거
        if (stockChart) {
            stockChart.destroy();
        }
        
        // 캔들스틱 데이터 포맷 변환
        const candlestickData = stockData.map((item, index) => ({
            x: index, // 인덱스를 x 값으로 사용
            o: item.open,
            h: item.high,
            l: item.low,
            c: item.close,
            date: item.date // 툴팁에 표시할 날짜 정보
        }));
        
        // 종가 데이터 (라인 차트용)
        const closeData = stockData.map((item, index) => ({
            x: index,
            y: item.close
        }));
        
        // Y축 범위 계산
        const allPrices = stockData.flatMap(item => [item.open, item.high, item.low, item.close]);
        const minPrice = Math.min(...allPrices) * 0.98; // 최소값보다 약간 낮게
        const maxPrice = Math.max(...allPrices) * 1.02; // 최대값보다 약간 높게
        
        // 차트 생성
        stockChart = new Chart(ctx, {
            data: {
                datasets: [
                    // 캔들스틱 데이터셋
                    {
                        type: 'candlestick',
                        label: '주가',
                        data: candlestickData,
                        color: {
                            up: 'rgba(255, 99, 132, 0.8)',
                            down: 'rgba(54, 162, 235, 0.8)',
                            unchanged: 'rgba(110, 110, 110, 0.8)',
                        },
                        borderWidth: 1,
                        order: 1 // 렌더링 순서 (낮을수록 먼저 그려짐)
                    },
                    // 종가 라인 데이터셋
                    {
                        type: 'line',
                        label: '종가',
                        data: closeData,
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.1,
                        order: 0, // 캔들스틱 위에 그려짐
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        display: false, // x축 숨김
                        grid: {
                            display: false // 그리드 숨김
                        }
                    },
                    y: {
                        position: 'right',
                        display: false, // y축 숨김
                        min: minPrice, // Y축 최소값 설정
                        max: maxPrice, // Y축 최대값 설정
                        grid: {
                            display: false // 그리드 숨김
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const item = tooltipItems[0];
                                const dataIndex = item.dataIndex;
                                return stockData[dataIndex].date;
                            },
                            label: function(context) {
                                if (context.dataset.type === 'candlestick') {
                                    const dataPoint = context.raw;
                                    return [
                                        `Open: ${dataPoint.o.toFixed(2)}`,
                                        `High: ${dataPoint.h.toFixed(2)}`,
                                        `Low: ${dataPoint.l.toFixed(2)}`,
                                        `Close: ${dataPoint.c.toFixed(2)}`
                                    ];
                                } else if (context.dataset.label === '종가') {
                                    return `Close: ${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    legend: {
                        display: false // 범례 숨김
                    }
                }
            }
        });
    }
    
    // 트레이드 제출 함수
    function submitTrade(position) {
        disableTradeButtons();
        
        const tradeData = {
            position: position,
            currentWeek: currentWeek,
            ticker: gameInfo.ticker  // ticker 정보 추가
        };
        
        fetch('/api/submit-trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `서버 응답 오류: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("트레이드 응답:", data);
            
            // PnL 업데이트
            const weeklyPnl = data.pnl;
            totalPnl += weeklyPnl;
            
            // 트레이드 기록 추가
            addTradeToHistory(position, weeklyPnl);
            tradeHistory.push({
                week: currentWeek,
                position: position,
                pnl: weeklyPnl
            });
            
            // PnL 표시 업데이트
            updatePnlDisplay(weeklyPnl);
            
            // PnL 차트 업데이트
            updatePnlChart(currentWeek, totalPnl);
            
            // 게임 종료 확인
            if (data.isLastWeek) {
                if (data.ticker) {
                    gameInfo.ticker = data.ticker;
                }
                endGame();
                return;
            }
            
            // 다음 주차 데이터로 차트 업데이트
            if (data.nextData) {
                stockData = data.nextData;
                currentWeek++;
                updateWeekDisplay();
                renderChart();
            }
            
            // ticker 정보 업데이트
            if (data.ticker) {
                gameInfo.ticker = data.ticker;
                saveGameState();
                updateGameInfo();
            }
            
            enableTradeButtons();
        })
        .catch(error => {
            console.error('Error submitting trade:', error);
            alert(`트레이드 제출 중 오류가 발생했습니다: ${error.message}`);
            enableTradeButtons();
        });
    }
    
    // PnL 표시 업데이트
    function updatePnlDisplay(weeklyPnl) {
        weeklyPnlElement.textContent = formatPnl(weeklyPnl);
        totalPnlElement.textContent = formatPnl(totalPnl);
        
        // 색상 클래스 설정
        weeklyPnlElement.className = getPnlColorClass(weeklyPnl);
        totalPnlElement.className = getPnlColorClass(totalPnl);
    }
    
    // PnL 포맷팅
    function formatPnl(pnl) {
        const sign = pnl > 0 ? '+' : '';
        return `${sign}${pnl.toFixed(2)}%`;
    }
    
    // PnL 색상 클래스 가져오기
    function getPnlColorClass(pnl) {
        if (pnl > 0) return 'positive';
        if (pnl < 0) return 'negative';
        return 'neutral';
    }
    
    // 주차 표시 업데이트
    function updateWeekDisplay() {
        // 16주차부터 시작
        currentWeekElement.textContent = currentWeek;
    }
    
    // 기록 테이블에 행 추가
    function addTradeToHistory(position, pnl) {
        const row = document.createElement('tr');
        
        const weekCell = document.createElement('td');
        weekCell.textContent = currentWeek;
        
        const positionCell = document.createElement('td');
        // 포지션 한글화
        let positionText = '';
        switch(position) {
            case 'long':
                positionText = '매수';
                break;
            case 'neutral':
                positionText = '중립';
                break;
            case 'short':
                positionText = '매도';
                break;
            default:
                positionText = position.charAt(0).toUpperCase() + position.slice(1);
        }
        positionCell.textContent = positionText;
        
        const pnlCell = document.createElement('td');
        pnlCell.textContent = formatPnl(pnl);
        pnlCell.className = getPnlColorClass(pnl);
        
        row.appendChild(weekCell);
        row.appendChild(positionCell);
        row.appendChild(pnlCell);
        
        historyTableBody.appendChild(row);
        
        // 스크롤을 맨 아래로 이동
        const historyContainer = document.querySelector('.history-container');
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }
    
    // 기록 테이블 초기화
    function clearHistoryTable() {
        historyTableBody.innerHTML = '';
    }
    
    // 트레이드 버튼 활성화
    function enableTradeButtons() {
        longBtn.disabled = false;
        neutralBtn.disabled = false;
        shortBtn.disabled = false;
    }
    
    // 트레이드 버튼 비활성화
    function disableTradeButtons() {
        longBtn.disabled = true;
        neutralBtn.disabled = true;
        shortBtn.disabled = true;
    }
    
    // 게임 종료
    function endGame() {
        // 최종 PnL 표시
        finalPnlElement.textContent = formatPnl(totalPnl);
        finalPnlElement.className = getPnlColorClass(totalPnl);
        
        // Buy and Hold PnL 계산 및 표시
        const buyHoldPnlElement = document.getElementById('buyHoldPnl');
        
        // 서버에서 Buy and Hold PnL 가져오기
        fetch('/api/buy-hold-pnl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ticker: gameInfo.ticker
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.buyHoldPnl) {
                const buyHoldPnl = data.buyHoldPnl;
                buyHoldPnlElement.textContent = formatPnl(buyHoldPnl);
                buyHoldPnlElement.className = getPnlColorClass(buyHoldPnl);
            } else {
                buyHoldPnlElement.textContent = "계산 불가";
            }
        })
        .catch(error => {
            console.error('Buy and Hold PnL 계산 오류:', error);
            buyHoldPnlElement.textContent = "계산 오류";
        });
        
        // 게임 정보 표시 업데이트 - 요소 존재 여부 확인 추가
        const gameTickerElement = document.getElementById('gameTicker');
        const gamePeriodElement = document.getElementById('gamePeriod');
        
        if (gameTickerElement) {
            gameTickerElement.textContent = gameInfo.ticker;
        } else {
            console.error('gameTicker 요소를 찾을 수 없습니다.');
        }
        
        if (gamePeriodElement) {
            // 거래기간 하드코딩
            gamePeriodElement.textContent = "2024/09/16 -- 2024/12/30";
        } else {
            console.error('gamePeriod 요소를 찾을 수 없습니다.');
        }
        
        // 모달 표시
        gameOverModal.style.display = 'flex';
    }
    
    // 게임 재시작 - 항상 랜덤 티커로 재시작
    function restartGame() {
        console.log("게임 재시작 요청 (랜덤 티커)");
        
        fetch('/api/restart-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})  // 빈 객체 전송 (서버에서 무시됨)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `서버 응답 오류: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("게임 재시작 응답:", data);
            
            // 모달 닫기
            gameOverModal.style.display = 'none';
            
            // 새 티커 정보로 게임 상태 업데이트
            if (data.ticker) {
                gameInfo.ticker = data.ticker;
                saveGameState();
            }
            
            // 게임 초기화
            initGame();
        })
        .catch(error => {
            console.error('Error restarting game:', error);
            alert(`게임 재시작 중 오류가 발생했습니다: ${error.message}`);
        });
    }
    
    // 게임 재시작 - 확인 대화상자 표시
    function restartGameWithConfirm() {
        if (confirm('새로운 랜덤 종목으로 게임을 다시 시작하시겠습니까? 현재 진행 상황은 저장되지 않습니다.')) {
            restartGame();
        }
    }
    
    // 게임 결과 공유
    function shareResults() {
        // Buy and Hold PnL 값 가져오기
        const buyHoldPnlElement = document.getElementById('buyHoldPnl');
        const buyHoldPnl = buyHoldPnlElement ? buyHoldPnlElement.textContent : 'N/A';
        
        // 공유할 텍스트 생성 - 누적 Profit, Buy and Hold 수익률, 종목, 기간 및 게임 링크 포함
        const shareText = `주식 트레이딩 시뮬레이터에서 ${formatPnl(totalPnl)}의 수익률을 달성했습니다!
종목 수익률: ${buyHoldPnl}
종목: ${gameInfo.ticker}
직접 도전해보세요!`;
        
        const shareUrl = window.location.href;
        const fullShareText = `${shareText}\n${shareUrl}`;
        
        // 공유 데이터 생성
        const shareData = {
            title: '주식 트레이딩 시뮬레이터 결과',
            text: shareText,
            url: shareUrl
        };
        
        // Web Share API 지원 확인
        if (navigator.share && navigator.canShare(shareData)) {
            navigator.share(shareData)
                .then(() => {
                    console.log('공유 성공');
                    showShareNotification('결과가 성공적으로 공유되었습니다!');
                })
                .catch((error) => {
                    console.log('공유 실패:', error);
                    // 공유 실패 시 클립보드에 복사
                    copyToClipboard(fullShareText);
                });
        } else {
            // Web Share API를 지원하지 않는 경우 클립보드에 복사
            copyToClipboard(fullShareText);
        }
    }
    
    // 클립보드에 복사하는 함수
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showShareNotification('결과가 클립보드에 복사되었습니다!');
                })
                .catch(err => {
                    console.error('클립보드 복사 실패:', err);
                    fallbackCopyToClipboard(text);
                });
        } else {
            fallbackCopyToClipboard(text);
        }
    }
    
    // 대체 클립보드 복사 방법
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showShareNotification('결과가 클립보드에 복사되었습니다!');
            } else {
                showShareNotification('클립보드에 복사하지 못했습니다.');
            }
        } catch (err) {
            console.error('클립보드 복사 실패:', err);
            showShareNotification('클립보드에 복사하지 못했습니다.');
        }
        
        document.body.removeChild(textArea);
    }
    
    // 공유 알림 표시 함수 개선
    function showShareNotification(message) {
        // 이미 존재하는 알림 제거
        const existingNotification = document.querySelector('.share-notification');
        if (existingNotification) {
            document.body.removeChild(existingNotification);
        }
        
        // 새 알림 생성
        const notification = document.createElement('div');
        notification.className = 'share-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 알림 표시 (애니메이션 효과 추가)
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 3초 후 알림 숨기기
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // 모달 닫기 함수
    function closeGameOverModal() {
        gameOverModal.style.display = 'none';
    }
}); 