from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import time
import os
import re

# ✅ 드라이버 경로 설정
driver_path = os.path.join(os.getcwd(), "chromedriver.exe")
options = webdriver.ChromeOptions()
# options.add_argument("--headless")  # 창 확인 원하면 주석처리
driver = webdriver.Chrome(service=Service(driver_path), options=options)
driver.get("https://fd.forest.go.kr/ffas/pubConn/movePage/sub1.do")
driver.maximize_window()

# ✅ 날짜 입력 필드 로딩 대기
WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "startDtm")))

# ✅ 날짜/상태/출력갯수 설정
start_date = "2024-10-01"
end_date = "2025-04-01"
print(f"📆 기간 설정: {start_date} ~ {end_date}")

driver.execute_script(f"""
    let startInput = document.getElementById('startDtm');
    let endInput = document.getElementById('endDtm');
    startInput.value = '{start_date}';
    startInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
    startInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
    endInput.value = '{end_date}';
    endInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
    endInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
""")

# 상태: 진화완료, 출력: 30건
Select(driver.find_element(By.ID, "prgrsCodeList")).select_by_value("03")
Select(driver.find_element(By.ID, "selectPerPage")).select_by_visible_text("30")

# 검색 클릭
search_button = driver.find_elements(By.CSS_SELECTOR, "button[type='button']")[0]
search_button.click()
time.sleep(3)

# ✅ 총 건수/페이지 계산
result_text = driver.find_element(By.CSS_SELECTOR, ".result .title").text
match = re.search(r"총\s*([\d,]+)건", result_text)
total_items = int(match.group(1).replace(",", "")) if match else 0
items_per_page = 30
total_pages = (total_items + items_per_page - 1) // items_per_page
print(f"🔢 총 {total_items}건 / {total_pages}페이지")

# ✅ 전체 페이지 순회 크롤링
rows = []
page = 1
while page <= total_pages:
    print(f"\n📄 페이지 {page} 크롤링 중...")

    try:
        # 현재 페이지 번호 클릭
        page_links = driver.find_elements(By.CSS_SELECTOR, ".paging a")
        page_clicked = False
        for a in page_links:
            alt = a.get_attribute("alt")
            if alt and alt.strip() == f"{page}페이지":
                driver.execute_script("arguments[0].click();", a)
                page_clicked = True
                time.sleep(2)
                break

        # 페이지 링크가 안 보이면 ▶ 눌러서 페이징 갱신
        if not page_clicked:
            try:
                next_group = driver.find_element(By.CSS_SELECTOR, ".paging .fa-chevron-right")
                driver.execute_script("arguments[0].click();", next_group.find_element(By.XPATH, "./.."))
                time.sleep(2)
                continue  # 다시 같은 page에서 클릭 시도
            except:
                print("❗ 다음 페이지 그룹 이동 실패")
                break

        # 테이블 파싱
        table = driver.find_element(By.CSS_SELECTOR, "#fireListWrap table tbody")
        trs = table.find_elements(By.TAG_NAME, "tr")

        count = 0
        for tr in trs:
            tds = tr.find_elements(By.TAG_NAME, "td")
            if len(tds) >= 5:
                row = {
                    "발생일시": tds[0].text.strip(),
                    "진화일시": tds[1].text.strip(),
                    "주소": tds[2].text.strip(),
                    "진행상태": tds[3].text.strip(),
                    "대응단계": tds[4].text.strip()
                }
                rows.append(row)
                count += 1
                print(f"  🔹 {count:02d}. {row['주소']} | {row['발생일시']} ~ {row['진화일시']}")

        page += 1

    except Exception as e:
        print(f"❌ 페이지 {page} 크롤링 실패: {e}")
        break

driver.quit()

# ✅ 저장
df = pd.DataFrame(rows)
output_file = "wildfire_all_2024_10_to_2025_04.csv"
df.to_csv(output_file, index=False, encoding="utf-8-sig")
print(f"\n✅ 전체 저장 완료: {output_file} (총 {len(df)}건)")
