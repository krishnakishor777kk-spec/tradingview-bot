import os
import sys
import subprocess

def install_mega():
    try:
        import mega
        print("mega.py library is already installed.")
    except ImportError:
        print("Installing mega.py library...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "mega.py"])
        print("Successfully installed mega.py.")

def download_files():
    # Install dependencies first
    install_mega()
    
    from mega import Mega
    mega = Mega()
    
    urls = [
        "https://mega.nz/file/MUM2STga#kQHW_lWlgh4ys24Qd5j6o31y0X4ykA-KdJVY--_BWD0",
        "https://mega.nz/file/oRUFDYgZ#TU_W3NFbzUzfZF45RkwpwXkmeJrsmAyTGEenTz4Uj0w",
        "https://mega.nz/file/FM0QCQQT#ThbQuDMrKQenhxC3aPaga8TmzC2J7kdR01YYdPH4Vo8",
        "https://mega.nz/file/gANh1IAQ#LOmDJxGBA4ug1dw2rQanPwGRLxoT3MAc3jk3UtciSSM",
        "https://mega.nz/file/YIsHDTJB#-VCSvuGozwf3peCjCpVoCby112KpYDM87PDc2VyIFTk",
        "https://mega.nz/file/8NFTmQ6J#k9Y1bm-mwsARQuvGBXsfFzoYk0PYfE7-qIr58ZbxkV8",
        "https://mega.nz/file/hEd2kKSQ#q4TLkDM-oMBJniCciB8-Pb8PkS980pKKLH5T5PYMpt8",
        "https://mega.nz/file/FVNAkYQI#_byMRj0J_yfETJsn60VlIBVHedGK61eVrJzgycJvFxI",
        "https://mega.nz/file/0NtwFCTB#mUgIPKpxd1uDVPVu_O6tuXndx92LjroYJ75Nb-ysYxM",
        "https://mega.nz/file/QclTRC7Z#qVnjgOGdoKUo3B37hKdLgDr9bzJ_mqrnsm6G5Nq1TOo",
        "https://mega.nz/file/YVV0BLxa#Q3aSdFY43ghIkhqW82w9LisOuUCK5ZAgwTw4R6XU6P0",
        "https://mega.nz/file/0MtWnYpR#Sh3-WbaRFW97ec99IRlhyGKzpVaMzwb15P51p-Zqa-Q",
        "https://mega.nz/file/BV13zbaT#5DrR6057kOrthkCsWOrCYIyRme7J49e6khyY4XmbLRI",
        "https://mega.nz/file/QIsUmahK#qAeY4COqzGRc2l1BWikomfx-9ujYddehwuyCSrmyD80",
        "https://mega.nz/file/4JEWUAID#LpMf2AY3MAIAoj5-Rt8M3M1vBsY61_isYB-hCszzXLU",
        "https://mega.nz/file/kVlFhZJT#3we1cYLXFbWuuX3Ko9iMWHT4SFzS7HZv_5nKpLyn92U",
        "https://mega.nz/file/AFsBUIID#_BFjgcljzySHdvOI0fwR6-51udiNrzGos3n0qhjzBKk",
        "https://mega.nz/file/1R1QmZTT#j3_kLsitOJIlgspi8xPzEFXOiG52gAZrVU1eU6FRG_I",
        "https://mega.nz/file/EFc0mLiL#1xXMZW4WQiwIuSllbWTBFBFt95mCXU5PSroAvMsc9ck",
        "https://mega.nz/file/NUNVmQTC#eYSkgcaws_DrcC5fBIXx0QS2TT-Dd3MYz1AF34wTJR8",
        "https://mega.nz/file/NJk1TRxa#nf8zZ63ci4AYAIrIX2Yi_obAOm5ezfnYE47SmCpz_ZE"
    ]
    
    download_dir = "downloads"
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
        
    print(f"Starting downloads for {len(urls)} files...")
    
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Downloading: {url}")
        try:
            # mega.download_url downloads to current folder by default
            # mega.download downloads to a custom folder if specified or uses download_url
            file_path = mega.download_url(url, dest_path=download_dir)
            print(f"--> Successfully downloaded: {file_path}")
        except Exception as e:
            print(f"--> Error downloading {url}: {e}")

if __name__ == "__main__":
    download_files()
