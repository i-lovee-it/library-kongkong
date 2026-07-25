# 도서관 출석 콩콩 Ver.4.0

## 파일 구성

- `index.html` : 이용자 출석 화면
- `style.css` : 이용자 화면 디자인
- `script.js` : 출석 처리
- `firebase.js` : Firebase 연결 설정
- `admin.html` : 관리자 화면
- `admin.css` : 관리자 화면 디자인
- `admin.js` : 참여자 조회·검색·선물 수령·CSV 저장·삭제
- `firestore.rules` : Firestore 보안 규칙

## 주요 기능

- 이름 + 생일 4자리로 참여자 구분
- 한국 시간 기준 하루 1회 출석
- 도토리 최대 30개
- 5회·15회 선물 달성 표시
- 관리자 검색, 새로고침, CSV 저장
- 관리자 비밀번호 초기값 `0509`
- 모바일·태블릿·PC 반응형 화면

## Firebase 연결

1. Firebase 콘솔에서 프로젝트를 만듭니다.
2. Firestore Database를 생성합니다.
3. 웹 앱을 추가합니다.
4. Firebase SDK 설정값을 복사합니다.
5. `firebase.js`의 `firebaseConfig` 값을 교체합니다.
6. Firestore 규칙 메뉴에 `firestore.rules` 내용을 붙여넣고 게시합니다.

## 실행 방법

로컬 파일을 더블클릭하면 모듈 보안 정책 때문에 Firebase가 작동하지 않을 수 있습니다.
GitHub Pages에 업로드하거나 VS Code의 Live Server로 실행하세요.

## 중요 보안 안내

현재 관리자 비밀번호 `0509`는 브라우저 코드에 포함되어 있어 강력한 보안 기능이 아닙니다.
실제 개인정보 보호가 중요한 장기 운영에는 Firebase Authentication과 별도 관리자 권한 구성이 필요합니다.
