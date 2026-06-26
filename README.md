# 배송기사 입고송장

모바일에서 창고입고 송장을 작성하고 A4로 인쇄할 수 있는 웹앱입니다.

## Railway 실행

Railway는 아래 명령으로 실행합니다.

```bash
npm start
```

앱은 Railway가 제공하는 `PORT` 환경변수를 자동으로 사용합니다.

## Supabase 공유 저장

`supabase-schema.sql` 내용을 Supabase SQL Editor에서 실행한 뒤 앱의 `공유 저장 설정`에 Supabase Project URL과 anon public key를 입력하면 PC와 휴대폰이 같은 저장 목록을 사용합니다.
