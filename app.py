from flask import Flask, render_template, request, jsonify, session
import pandas as pd
import random
import os
import json
import uuid

app = Flask(__name__)
app.secret_key = 'trading_game_secret_key'  # 세션을 위한 시크릿 키 설정

# 게임 세션 데이터를 저장할 딕셔너리
game_sessions = {}

def load_stock_data(ticker=None, session_id=None):
    """
    주식 데이터 로드 함수
    ticker: 특정 종목 코드 (지정하지 않으면 랜덤 선택)
    session_id: 세션 ID
    """
    # 이미 로드된 세션 데이터가 있으면 그것을 반환
    if session_id and session_id in game_sessions:
        return game_sessions[session_id].get('data', []), game_sessions[session_id].get('ticker', 'Unknown')
    
    try:
        # 데이터 폴더 경로 확인
        data_folder = './data'
        if not os.path.exists(data_folder):
            raise FileNotFoundError(f"데이터 폴더가 존재하지 않습니다: {data_folder}")
        
        # 데이터 폴더에서 CSV 파일 목록 가져오기
        data_files = [f for f in os.listdir(data_folder) if f.endswith('.csv')]
        
        if not data_files:
            raise FileNotFoundError("CSV 파일이 없습니다. data 폴더에 CSV 파일을 추가해주세요.")
        
        # 특정 ticker가 지정된 경우 해당 파일 사용
        if ticker:
            file_name = f"{ticker}.csv"
            if file_name in data_files:
                selected_file = file_name
            else:
                print(f"지정된 ticker({ticker})의 파일이 없습니다. 랜덤 선택합니다.")
                selected_file = random.choice(data_files)
        else:
            # 랜덤하게 주식 데이터 파일 선택
            selected_file = random.choice(data_files)
        
        file_path = os.path.join(data_folder, selected_file)
        
        # 파일 이름에서 ticker 추출 (확장자 제외)
        ticker = os.path.splitext(selected_file)[0]
        
        print(f"선택된 파일: {file_path}, Ticker: {ticker}")
        
        # 파일 존재 확인
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"파일이 존재하지 않습니다: {file_path}")
        
        # CSV 파일 로드
        df = pd.read_csv(file_path)
        
        # 날짜를 인덱스로 설정
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'])
            df.set_index('Date', inplace=True)
        
        # OHLC 컬럼이 있는지 확인
        required_cols = ['Open', 'High', 'Low', 'Close']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"필요한 컬럼이 없습니다. 필요한 컬럼: {required_cols}")
        
        # 데이터 포맷 변환
        result = []
        for idx, row in df.iterrows():
            result.append({
                'date': idx.strftime('%Y-%m-%d') if hasattr(idx, 'strftime') else str(idx),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close'])
            })
        
        # 데이터가 충분한지 확인 (최소 32개 필요)
        if len(result) < 32:
            raise ValueError(f"데이터가 충분하지 않습니다. 필요: 32개, 현재: {len(result)}개")
        
        # 세션 ID가 제공되면 데이터와 ticker를 세션에 저장
        if session_id:
            game_sessions[session_id] = {
                'data': result,
                'ticker': ticker
            }
        
        return result, ticker
    
    except Exception as e:
        print(f"데이터 로드 중 오류 발생: {str(e)}")
        raise

def calculate_pnl(position, current_data, next_data):
    if position == 'neutral':
        return 0
    
    current_close = current_data['close']
    next_close = next_data['close']
    
    price_change_pct = (next_close - current_close) / current_close
    
    if position == 'long':
        return price_change_pct * 100  # 백분율로 변환
    elif position == 'short':
        return -price_change_pct * 100  # 백분율로 변환
    
    return 0

@app.route('/')
def index():
    # 새 게임 세션 ID 생성
    session_id = str(uuid.uuid4())
    session['game_session_id'] = session_id
    
    # 새 세션을 위한 데이터 로드 시도
    try:
        load_stock_data(session_id=session_id)
    except Exception as e:
        print(f"초기 데이터 로드 실패: {str(e)}")
        # 오류가 발생해도 템플릿은 렌더링하고, 클라이언트에서 오류 처리
    
    return render_template('index.html')

@app.route('/api/stock-data')
def get_stock_data():
    try:
        session_id = session.get('game_session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            session['game_session_id'] = session_id
        
        # 클라이언트에서 전달된 ticker 확인
        ticker = request.args.get('ticker')
        
        # 데이터 로드
        data, ticker = load_stock_data(ticker=ticker, session_id=session_id)
        
        # 데이터 유효성 검사
        if not data or len(data) < 32:
            raise ValueError(f"유효하지 않은 데이터: {len(data) if data else 0}개 항목")
        
        # 16주차 게임을 위한 데이터 (0-15주차 데이터)
        result = data[:16]
        
        # 응답에 ticker 정보 추가
        response = {
            'data': result,
            'ticker': ticker
        }
        
        print(f"클라이언트에 반환하는 데이터: {len(result)}개 항목, ticker={ticker}")
        return jsonify(response)
    
    except Exception as e:
        print(f"API 호출 중 오류 발생: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-trade', methods=['POST'])
def submit_trade():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '요청 데이터가 없습니다.'}), 400
            
        position = data.get('position')
        current_week = data.get('currentWeek')
        
        if position not in ['long', 'short', 'neutral']:
            return jsonify({'error': f'유효하지 않은 포지션: {position}'}), 400
            
        if current_week is None:
            return jsonify({'error': '주차 정보가 없습니다.'}), 400
        
        print(f"트레이드 요청: 포지션={position}, 주차={current_week}")
        
        # 세션에서 주식 데이터 가져오기
        session_id = session.get('game_session_id')
        if not session_id:
            return jsonify({'error': '세션이 유효하지 않습니다.'}), 400
            
        if session_id not in game_sessions:
            # 클라이언트에서 전달된 ticker로 데이터 다시 로드 시도
            ticker = data.get('ticker')
            if ticker:
                try:
                    print(f"세션 데이터 없음, ticker={ticker}로 다시 로드 시도")
                    load_stock_data(ticker=ticker, session_id=session_id)
                except Exception as e:
                    return jsonify({'error': f'데이터 로드 실패: {str(e)}'}), 500
            else:
                return jsonify({'error': '세션 데이터를 찾을 수 없습니다. 게임을 다시 시작해주세요.'}), 400
            
        stock_data = game_sessions[session_id].get('data', [])
        ticker = game_sessions[session_id].get('ticker', 'Unknown')
        
        if not stock_data or len(stock_data) < 32:
            return jsonify({'error': '주식 데이터가 충분하지 않습니다.'}), 400
        
        # 현재 게임 주차에 해당하는 데이터 인덱스 계산
        current_data_idx = current_week
        
        # 이전 주차 데이터 인덱스 (PnL 계산용)
        prev_data_idx = current_data_idx - 1
        
        print(f"데이터 인덱스: 이전={prev_data_idx}, 현재={current_data_idx}, 데이터 길이={len(stock_data)}")
        
        # 인덱스 범위 확인
        if prev_data_idx < 0:
            return jsonify({'error': '첫 주차에서는 PnL을 계산할 수 없습니다.'}), 400
            
        if current_data_idx >= len(stock_data):
            return jsonify({'error': f'주차 인덱스({current_data_idx})가 데이터 범위를 벗어났습니다.'}), 400
        
        # 현재 주차와 이전 주차 데이터로 PnL 계산
        try:
            prev_data = stock_data[prev_data_idx]
            current_data = stock_data[current_data_idx]
            
            # PnL 계산 (현재 주차 close와 이전 주차 close 사용)
            pnl = calculate_pnl(position, prev_data, current_data)
        except Exception as e:
            return jsonify({'error': f'PnL 계산 중 오류 발생: {str(e)}'}), 500
        
        # 다음 게임 주차 (UI에 표시될 주차)
        next_game_week = current_week + 1
        
        # 다음 주차를 위한 차트 데이터 준비
        next_data_idx = current_data_idx + 1
        
        # 다음 주차 데이터가 있는지 확인
        if next_data_idx >= len(stock_data):
            return jsonify({
                'pnl': round(pnl, 2),
                'nextData': None,
                'isLastWeek': True,
                'ticker': ticker
            })
        
        # 다음 주차를 위한 데이터 윈도우 준비 (이전 16주 데이터)
        start_idx = next_data_idx - 16  # 시작 인덱스 (다음 주차 - 16)
        end_idx = next_data_idx         # 종료 인덱스 (다음 주차 - 1)
        
        # 시작 인덱스가 음수가 되지 않도록 조정
        start_idx = max(0, start_idx)
        
        # 다음 데이터 윈도우 준비
        next_data_window = stock_data[start_idx:end_idx]
        
        # 게임 종료 조건: 31주차까지 진행했거나 더 이상 데이터가 없는 경우
        is_last_week = next_game_week >= 32 or next_data_idx >= len(stock_data)
        
        response_data = {
            'pnl': round(pnl, 2),
            'nextData': next_data_window,
            'isLastWeek': is_last_week,
            'ticker': ticker  # 항상 ticker 정보 포함
        }
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"트레이드 제출 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/restart-game', methods=['POST'])
def restart_game():
    try:
        # 새 게임 세션 ID 생성
        session_id = str(uuid.uuid4())
        session['game_session_id'] = session_id
        
        # 클라이언트에서 전달된 ticker 확인
        data = request.get_json() or {}
        ticker = data.get('ticker')
        
        # 새 세션을 위한 데이터 로드
        data, ticker = load_stock_data(ticker=ticker, session_id=session_id)
        
        return jsonify({
            'success': True,
            'ticker': ticker
        })
    except Exception as e:
        print(f"게임 재시작 중 오류 발생: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/buy-hold-pnl', methods=['POST'])
def get_buy_hold_pnl():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '요청 데이터가 없습니다.'}), 400
            
        ticker = data.get('ticker')
        if not ticker:
            return jsonify({'error': 'ticker 정보가 없습니다.'}), 400
        
        # 세션에서 주식 데이터 가져오기
        session_id = session.get('game_session_id')
        
        # 데이터 로드
        stock_data, _ = load_stock_data(ticker=ticker)
        
        if not stock_data or len(stock_data) < 32:
            return jsonify({'error': '주식 데이터가 충분하지 않습니다.'}), 400
        
        # Buy and Hold 전략 (모든 주차에 Long 포지션)
        buy_hold_pnl = 0
        
        # 16주차부터 31주차까지 계산 (게임과 동일한 기간)
        for i in range(16, min(32, len(stock_data))):
            if i >= 16:  # 첫 주차는 건너뜀
                prev_data = stock_data[i-1]
                current_data = stock_data[i]
                
                # Long 포지션의 PnL 계산
                week_pnl = calculate_pnl('long', prev_data, current_data)
                buy_hold_pnl += week_pnl
        
        return jsonify({
            'buyHoldPnl': round(buy_hold_pnl, 2)
        })
    
    except Exception as e:
        print(f"Buy and Hold PnL 계산 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 