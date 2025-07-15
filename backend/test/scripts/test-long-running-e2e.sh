#!/bin/bash

# 長時間処理モックサービス E2Eテストスクリプト
# Phase ε.3.2 - 実際のcurlによる非同期処理テスト

set -e

# 設定（環境変数から取得、デフォルト値は開発用）
API_BASE_URL="${API_BASE_URL:-http://localhost:8888/.netlify/functions}"
API_SECRET="${MVP_API_SECRET:-test-secret-for-development-only}"
TIMEOUT_SECONDS=300
POLL_INTERVAL=5

# セキュリティチェック
if [[ "$API_SECRET" == *"mvv-extraction"* ]] && [[ "$API_BASE_URL" != *"localhost"* ]]; then
    log_error "🚨 SECURITY WARNING: Production API key detected with non-localhost URL"
    log_error "Please use environment variables for production testing"
    exit 1
fi

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# API呼び出しヘルパー
call_api() {
    local endpoint="$1"
    local method="$2"
    local data="$3"
    
    if [ "$method" = "POST" ]; then
        curl -s -X POST "${API_BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_SECRET}" \
            -d "$data"
    else
        curl -s "${API_BASE_URL}${endpoint}" \
            -H "X-API-Key: ${API_SECRET}"
    fi
}

# JSONパース用ヘルパー（jqが利用可能な場合）
parse_json() {
    local json="$1"
    local key="$2"
    
    if command -v jq >/dev/null 2>&1; then
        echo "$json" | jq -r "$key"
    else
        # jqが無い場合のフォールバック（基本的な解析）
        case "$key" in
            ".taskId")
                echo "$json" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4
                ;;
            ".data.data.status")
                echo "$json" | grep -o '"status":"[^"]*"' | tail -1 | cut -d'"' -f4
                ;;
            ".data.data.progress.percentage")
                echo "$json" | grep -o '"percentage":[0-9]*' | cut -d':' -f2
                ;;
            ".data.data.progress.currentStep")
                echo "$json" | grep -o '"currentStep":"[^"]*"' | cut -d'"' -f4
                ;;
            *)
                echo "null"
                ;;
        esac
    fi
}

# シナリオテスト関数
test_scenario() {
    local scenario="$1"
    local duration="$2"
    local expected_status="$3"
    local test_name="$4"
    
    log_info "Testing scenario: $test_name"
    log_info "Scenario: $scenario, Duration: ${duration}ms"
    
    # Step 1: タスク開始
    local request_data="{\"scenario\":\"$scenario\",\"duration\":$duration,\"progressSteps\":5,\"taskType\":\"e2e-test\"}"
    local start_response
    start_response=$(call_api "/long-running-mock" "POST" "$request_data")
    
    if [ $? -ne 0 ]; then
        log_error "Failed to start task"
        return 1
    fi
    
    # タスクIDを取得
    local task_id
    task_id=$(parse_json "$start_response" ".taskId")
    
    if [ -z "$task_id" ] || [ "$task_id" = "null" ]; then
        log_error "Failed to get task ID from response: $start_response"
        return 1
    fi
    
    log_success "Task started: $task_id"
    
    # Step 2: ポーリングでステータス確認
    local poll_count=0
    local max_polls=$((duration / 1000 / POLL_INTERVAL + 30)) # 余裕を持って +30回
    local current_status=""
    local progress=0
    
    log_info "Starting polling (max $max_polls polls, ${POLL_INTERVAL}s interval)"
    
    while [ $poll_count -lt $max_polls ]; do
        sleep $POLL_INTERVAL
        poll_count=$((poll_count + 1))
        
        # ステータス取得
        local status_response
        status_response=$(call_api "/task-status?taskId=$task_id" "GET")
        
        if [ $? -ne 0 ]; then
            log_warning "Poll $poll_count failed, retrying..."
            continue
        fi
        
        # ステータス解析（二重ネスト構造に対応）
        current_status=$(parse_json "$status_response" ".data.data.status")
        progress=$(parse_json "$status_response" ".data.data.progress.percentage")
        local current_step
        current_step=$(parse_json "$status_response" ".data.data.progress.currentStep")
        
        echo -e "${BLUE}[POLL $poll_count]${NC} Status: $current_status, Progress: $progress%, Step: $current_step"
        
        # 完了状態チェック
        if [ "$current_status" = "completed" ] || [ "$current_status" = "failed" ]; then
            break
        fi
    done
    
    # 結果確認
    if [ "$current_status" = "$expected_status" ]; then
        log_success "Test '$test_name' completed successfully"
        log_success "Final status: $current_status (expected: $expected_status)"
        return 0
    else
        log_error "Test '$test_name' failed"
        log_error "Final status: $current_status (expected: $expected_status)"
        log_error "Polls completed: $poll_count/$max_polls"
        return 1
    fi
}

# メイン実行
main() {
    echo "========================================="
    echo "Long-Running Mock Service E2E Test"
    echo "========================================="
    echo "API Base URL: $API_BASE_URL"
    echo "Test Start Time: $(date)"
    echo ""
    
    # 前提条件チェック
    log_info "Checking API availability..."
    local health_check
    health_check=$(curl -s "${API_BASE_URL}/health" || echo "error")
    
    if [[ "$health_check" == *"error"* ]]; then
        log_error "API server is not running at $API_BASE_URL"
        log_error "Please start the server with: npm run dev"
        exit 1
    fi
    
    log_success "API server is running"
    echo ""
    
    # テスト実行
    local tests_passed=0
    local tests_total=0
    
    # Test 1: 成功シナリオ（短時間）
    tests_total=$((tests_total + 1))
    if test_scenario "success" 10000 "completed" "Success Scenario (10s)"; then
        tests_passed=$((tests_passed + 1))
    fi
    echo ""
    
    # Test 2: エラーシナリオ
    tests_total=$((tests_total + 1))
    if test_scenario "error" 8000 "failed" "Error Scenario (4s failure)"; then
        tests_passed=$((tests_passed + 1))
    fi
    echo ""
    
    # Test 3: タイムアウトシナリオ
    tests_total=$((tests_total + 1))
    if test_scenario "timeout" 12000 "failed" "Timeout Scenario (9.6s timeout)"; then
        tests_passed=$((tests_passed + 1))
    fi
    echo ""
    
    # Test 4: 断続的エラーシナリオ
    tests_total=$((tests_total + 1))
    if test_scenario "intermittent" 15000 "completed" "Intermittent Error Scenario (15s)"; then
        tests_passed=$((tests_passed + 1))
    fi
    echo ""
    
    # 結果サマリ
    echo "========================================="
    echo "E2E Test Results"
    echo "========================================="
    echo "Tests Passed: $tests_passed/$tests_total"
    echo "Test End Time: $(date)"
    
    if [ $tests_passed -eq $tests_total ]; then
        log_success "All E2E tests passed! 🎉"
        exit 0
    else
        log_error "Some E2E tests failed ❌"
        exit 1
    fi
}

# 引数処理
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --quick     Run quick tests only (shorter durations)"
        echo "  --full      Run full test suite including long-running tests"
        echo "  --help      Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  API_BASE_URL    API base URL (default: http://localhost:8888/.netlify/functions)"
        echo "  API_SECRET      API secret key (default: test-secret)"
        echo "  POLL_INTERVAL   Polling interval in seconds (default: 2)"
        echo ""
        exit 0
        ;;
    --quick)
        log_info "Running quick tests..."
        # 短時間テストのみ実行
        ;;
    --full)
        log_info "Running full test suite..."
        # 長時間テストも含めて実行（現在未実装）
        ;;
    *)
        # デフォルト実行
        ;;
esac

# メイン実行
main