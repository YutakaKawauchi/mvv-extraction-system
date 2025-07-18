#!/bin/bash

# Netlify Blobs 汎用一括削除スクリプト
# 使用例:
#   ./scripts/cleanup-blobs.sh list-stores                           # ストア一覧表示
#   ./scripts/cleanup-blobs.sh dry-run async-task-results           # 削除リストのみ表示
#   ./scripts/cleanup-blobs.sh all async-task-results               # 全削除
#   ./scripts/cleanup-blobs.sh orphaned async-task-results          # 24時間以上前のブロブを削除
#   ./scripts/cleanup-blobs.sh pattern async-task-results "async_1752.*"  # パターンマッチ削除

set -e

# 設定
API_BASE_URL="https://comforting-sorbet-612b07.netlify.app/.netlify/functions"
API_SECRET="${MVP_API_SECRET}"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 使用法表示
show_usage() {
    echo -e "${BLUE}Netlify Blobs 汎用一括削除ツール${NC}"
    echo ""
    echo "使用法:"
    echo "  $0 list-stores                           # 利用可能なストア一覧を表示"
    echo "  $0 dry-run <store>                       # 削除リストのみ表示（安全確認）"
    echo "  $0 all <store>                           # 全ブロブを削除"
    echo "  $0 orphaned <store> [hours]              # 指定時間以上前のブロブを削除（デフォルト: 24時間）"
    echo "  $0 pattern <store> <pattern>             # パターンマッチするブロブを削除"
    echo ""
    echo "例:"
    echo "  $0 list-stores                           # まずストア一覧を確認"
    echo "  $0 dry-run async-task-results            # async-task-resultsストアの削除候補を確認"
    echo "  $0 orphaned async-task-results 1         # 1時間以上前のブロブを削除"
    echo "  $0 pattern cache-store \"temp_.*\"         # cache-storeから特定パターンのブロブを削除"
    echo "  $0 all temp-data                         # temp-dataストアを完全にクリア"
    echo ""
    echo "よく使われるストア:"
    echo "  async-task-results                       # 非同期タスクの結果データ"
    echo "  cache-store                              # キャッシュデータ"
    echo "  temp-data                                # 一時データ"
    echo "  user-uploads                             # ユーザーアップロードファイル"
    echo ""
    echo "環境変数:"
    echo "  MVP_API_SECRET                           # API認証キー（必須）"
}

# API呼び出し関数
call_cleanup_api() {
    local payload="$1"
    local response
    
    if [ -z "$API_SECRET" ]; then
        echo -e "${RED}エラー: MVP_API_SECRET 環境変数が設定されていません${NC}"
        echo "export MVP_API_SECRET=\"your-api-secret\""
        exit 1
    fi
    
    echo -e "${BLUE}API呼び出し中...${NC}"
    echo "Payload: $payload"
    
    response=$(curl -s -w "%{http_code}" -X DELETE \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_SECRET" \
        -d "$payload" \
        "$API_BASE_URL/cleanup-all-blobs")
    
    # HTTPステータスコードを抽出
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✅ 成功 (HTTP $http_code)${NC}"
        echo "$response_body" | jq '.'
        return 0
    else
        echo -e "${RED}❌ エラー (HTTP $http_code)${NC}"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
        return 1
    fi
}

# メイン処理
main() {
    local mode="$1"
    local store="$2"
    local param="$3"
    
    # 引数チェック
    if [ -z "$mode" ]; then
        show_usage
        exit 1
    fi
    
    # jq の存在確認
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}警告: jq が見つかりません。JSONレスポンスの表示が制限されます${NC}"
        echo "インストール: sudo apt-get install jq"
        echo ""
    fi
    
    case "$mode" in
        "list-stores")
            echo -e "${BLUE}📋 利用可能なストア一覧を取得中...${NC}"
            call_cleanup_api '{"action": "list-stores"}'
            ;;
            
        "dry-run")
            if [ -z "$store" ]; then
                echo -e "${RED}エラー: ストア名が指定されていません${NC}"
                show_usage
                exit 1
            fi
            echo -e "${YELLOW}🔍 ストア '${store}' の削除候補を確認中...${NC}"
            call_cleanup_api "{\"store\": \"$store\", \"mode\": \"orphaned\", \"dryRun\": true}"
            ;;
            
        "all")
            if [ -z "$store" ]; then
                echo -e "${RED}エラー: ストア名が指定されていません${NC}"
                show_usage
                exit 1
            fi
            echo -e "${RED}⚠️  ストア '${store}' の全ブロブ削除モード${NC}"
            echo -e "${YELLOW}5秒待機中... (Ctrl+C でキャンセル)${NC}"
            sleep 5
            echo -e "${RED}🗑️  ストア '${store}' の全ブロブを削除中...${NC}"
            call_cleanup_api "{\"store\": \"$store\", \"mode\": \"all\", \"dryRun\": false}"
            ;;
            
        "orphaned")
            if [ -z "$store" ]; then
                echo -e "${RED}エラー: ストア名が指定されていません${NC}"
                show_usage
                exit 1
            fi
            local hours="${param:-24}"
            local seconds=$((hours * 3600))
            echo -e "${YELLOW}🧹 ストア '${store}' の${hours}時間以上前のブロブを削除中...${NC}"
            call_cleanup_api "{\"store\": \"$store\", \"mode\": \"orphaned\", \"maxAge\": $seconds, \"dryRun\": false}"
            ;;
            
        "pattern")
            if [ -z "$store" ] || [ -z "$param" ]; then
                echo -e "${RED}エラー: ストア名またはパターンが指定されていません${NC}"
                show_usage
                exit 1
            fi
            echo -e "${YELLOW}🎯 ストア '${store}' でパターン \"$param\" にマッチするブロブを削除中...${NC}"
            call_cleanup_api "{\"store\": \"$store\", \"mode\": \"pattern\", \"pattern\": \"$param\", \"dryRun\": false}"
            ;;
            
        *)
            echo -e "${RED}エラー: 不明なモード \"$mode\"${NC}"
            show_usage
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"