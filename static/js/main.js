document.addEventListener('DOMContentLoaded', function() {
    // 전역 변수
    let stockData = [];
    let currentWeek = 0;
    let totalPnl = 0;
    let tradeHistory = [];
    let stockChart = null;
    let pnlChart = null;  // PnL 차트 변수 추가
    
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
    const shareBtn = document.getElementById('shareBtn');
    
    // 게임 초기화
    initGame();
    
    // 버튼 이벤트 리스너
    longBtn.addEventListener('click', () => submitTrade('long'));
    neutralBtn.addEventListener('click', () => submitTrade('neutral'));
    shortBtn.addEventListener('click', () => submitTrade('short'));
    restartBtn.addEventListener('click', restartGame);
    shareBtn.addEventListener('click', shareResults);
    
    // 게임 초기화 함수
    function initGame() {
        console.log("게임 초기화 시작...");
        
        fetch('/api/stock-data')
            .then(response => {
                console.log("서버 응답 상태:", response.status);
                if (!response.ok) {
                    throw new Error(`서버 응답 오류: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("데이터 수신 성공:", data.length, "개 항목");
                
                if (!data || data.length === 0) {
                    console.error("빈 데이터 수신");
                    throw new Error("서버에서 빈 데이터를 반환했습니다");
                }
                
                stockData = data;
                currentWeek = 16;  // 16주차부터 시작
                totalPnl = 0;
                tradeHistory = [];
                
                updateWeekDisplay();
                renderChart();
                initPnlChart();
                updatePnlDisplay(0);
                clearHistoryTable();
                
                enableTradeButtons();
            })
            .catch(error => {
                console.error('Error fetching stock data:', error);
                
                // 샘플 데이터로 대체
                console.log("샘플 데이터로 게임 초기화 시도...");
                generateSampleData()
                    .then(sampleData => {
                        stockData = sampleData;
                        currentWeek = 16;
                        totalPnl = 0;
                        tradeHistory = [];
                        
                        updateWeekDisplay();
                        renderChart();
                        initPnlChart();  // PnL 차트 초기화
                        updatePnlDisplay(0);
                        clearHistoryTable();
                        
                        enableTradeButtons();
                    })
                    .catch(sampleError => {
                        console.error('샘플 데이터 생성 실패:', sampleError);
                        alert('주식 데이터를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.');
                    });
            });
    }
    
    // PnL 차트 초기화 함수
    function initPnlChart() {
        const ctx = document.getElementById('pnlChart').getContext('2d');
        
        // 이전 차트 제거
        if (pnlChart) {
            pnlChart.destroy();
        }
        
        // 초기 데이터 (시작점)
        const labels = ['Week 16'];
        const data = [0];
        
        // 차트 생성 - 성능 최적화
        pnlChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '누적 PnL (%)',
                    data: data,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 3, // 포인트 크기 줄임
                    pointHoverRadius: 5 // 호버 시 포인트 크기 줄임
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300 // 애니메이션 시간 줄임
                },
                elements: {
                    line: {
                        borderWidth: 2 // 선 두께 줄임
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: '누적 PnL (%)',
                            font: {
                                size: 10 // 글자 크기 줄임
                            }
                        },
                        ticks: {
                            font: {
                                size: 10 // 글자 크기 줄임
                            }
                        },
                        grid: {
                            display: true,
                            color: function(context) {
                                if (context.tick.value === 0) {
                                    return 'rgba(0, 0, 0, 0.2)';
                                }
                                return 'rgba(0, 0, 0, 0.1)';
                            },
                            lineWidth: function(context) {
                                if (context.tick.value === 0) {
                                    return 2;
                                }
                                return 1;
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '주차',
                            font: {
                                size: 10 // 글자 크기 줄임
                            }
                        },
                        ticks: {
                            font: {
                                size: 10, // 글자 크기 줄임
                                maxRotation: 0, // 회전 없음
                                autoSkip: true, // 자동 건너뛰기
                                maxTicksLimit: 8 // 최대 표시 개수 제한
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // 범례 숨김
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                return `누적 PnL: ${context.parsed.y.toFixed(2)}%`;
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
        pnlChart.data.labels.push(`Week ${week}`);
        
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
    
    // 차트 렌더링 함수
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
                        ticks: {
                            callback: function(value) {
                                // 인덱스를 주차로 변환
                                if (value >= 0 && value < stockData.length) {
                                    return stockData[value].date;
                                }
                                return '';
                            },
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        position: 'right',
                        title: {
                            display: true,
                            text: '가격'
                        },
                        min: minPrice, // Y축 최소값 설정
                        max: maxPrice, // Y축 최대값 설정
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2);
                            }
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
                                        `시가: ${dataPoint.o.toFixed(2)}`,
                                        `고가: ${dataPoint.h.toFixed(2)}`,
                                        `저가: ${dataPoint.l.toFixed(2)}`,
                                        `종가: ${dataPoint.c.toFixed(2)}`
                                    ];
                                } else if (context.dataset.label === '종가') {
                                    return `종가: ${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 10,
                            padding: 10,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 트레이드 제출 함수
    function submitTrade(position) {
        // 트레이드 버튼 비활성화
        disableTradeButtons();
        
        console.log(`트레이드 제출: ${position}, 주차: ${currentWeek}`);
        
        fetch('/api/submit-trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                position: position,
                currentWeek: currentWeek
            })
        })
        .then(response => {
            console.log("서버 응답 상태:", response.status);
            if (!response.ok) {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("트레이드 응답 데이터:", data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const weeklyPnl = data.pnl;
            
            // 트레이드 기록 업데이트
            tradeHistory.push({
                week: currentWeek,
                position: position,
                pnl: weeklyPnl
            });
            
            // PnL 업데이트
            totalPnl += weeklyPnl;
            updatePnlDisplay(weeklyPnl);
            
            // 다음 주차 계산
            const nextWeek = currentWeek + 1;
            
            // PnL 차트 업데이트
            updatePnlChart(currentWeek, totalPnl);
            
            // 기록 테이블 업데이트
            addHistoryRow(currentWeek, position, weeklyPnl);
            
            // 다음 주로 이동
            currentWeek = nextWeek;
            updateWeekDisplay();
            
            // 다음 주 데이터가 있으면 차트 업데이트
            if (data.nextData) {
                console.log(`다음 주 데이터 수신: ${data.nextData.length}개 항목`);
                // 롤링 윈도우 데이터로 stockData 업데이트
                stockData = data.nextData;
                renderChart();
                enableTradeButtons();
            }
            
            // 게임 종료 체크
            if (data.isLastWeek) {
                endGame();
            }
        })
        .catch(error => {
            console.error('Error submitting trade:', error);
            alert('트레이드 제출에 실패했습니다: ' + error.message);
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
    function addHistoryRow(week, position, pnl) {
        const row = document.createElement('tr');
        
        const weekCell = document.createElement('td');
        weekCell.textContent = week;  // 16주차부터 시작
        
        const positionCell = document.createElement('td');
        positionCell.textContent = position.charAt(0).toUpperCase() + position.slice(1);
        
        const pnlCell = document.createElement('td');
        pnlCell.textContent = formatPnl(pnl);
        pnlCell.className = getPnlColorClass(pnl);
        
        row.appendChild(weekCell);
        row.appendChild(positionCell);
        row.appendChild(pnlCell);
        
        historyTableBody.appendChild(row);
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
        finalPnlElement.textContent = formatPnl(totalPnl);
        finalPnlElement.className = getPnlColorClass(totalPnl);
        gameOverModal.style.display = 'flex';
    }
    
    // 게임 재시작
    function restartGame() {
        gameOverModal.style.display = 'none';
        
        // 서버에 게임 재시작 요청
        fetch('/api/restart-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                initGame();
            }
        })
        .catch(error => {
            console.error('Error restarting game:', error);
            initGame(); // 에러가 발생해도 게임 초기화 시도
        });
    }
    
    // 게임 결과 공유
    function shareResults() {
        // 공유할 텍스트 생성
        const shareText = `주식 모의 트레이딩 게임 결과: 최종 PnL ${formatPnl(totalPnl)}! 당신도 도전해보세요!`;
        const shareUrl = window.location.href;
        
        // 공유 데이터 생성
        const shareData = {
            title: '주식 모의 트레이딩 게임',
            text: shareText,
            url: shareUrl
        };
        
        // Web Share API 지원 확인
        if (navigator.share && navigator.canShare(shareData)) {
            navigator.share(shareData)
                .then(() => console.log('공유 성공'))
                .catch((error) => console.log('공유 실패:', error));
        } else {
            // Web Share API를 지원하지 않는 경우 클립보드에 복사
            const fullShareText = `${shareText}\n${shareUrl}`;
            
            navigator.clipboard.writeText(fullShareText)
                .then(() => {
                    showShareNotification('결과가 클립보드에 복사되었습니다!');
                })
                .catch(err => {
                    console.error('클립보드 복사 실패:', err);
                    // 대체 방법: 텍스트 영역 생성 후 복사
                    const textArea = document.createElement('textarea');
                    textArea.value = fullShareText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showShareNotification('결과가 클립보드에 복사되었습니다!');
                });
        }
    }
    
    // 공유 알림 표시
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
        
        // 알림 표시
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 3초 후 알림 숨기기
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}); 