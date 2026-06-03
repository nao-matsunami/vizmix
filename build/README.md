# build/ アセット

## icon.icns（VizMix アプリアイコン v1）

VizMix mac版（Electron）のアプリアイコン。electron-builder が既定で
`build/icon.icns` を mac アプリアイコンとして使用する。

**デザイン仕様（v1 / 後日変更可）**
- 背景: 純黒 #0a0a0a の角丸正方形タイル（1024キャンバスに 824×824 / 余白100 / 角丸180、Big Surグリッド準拠）
- 中央〜上部に大きな白い「V」: Helvetica Neue Bold（cap-height ≒ タイル高さの約55%）, #ffffff
- 下部（タイル下端から約18%）に横フェーダー: 細いグレーレール #4a4a4a（角丸端）＋中央に白い直角ノブ #ffffff（20×60, 角丸なし）
- モノクロ（AESTHETIC_DNA Phase 1準拠）。要素は V とフェーダーのみ。

## ソース / マスター
- `icon.html` … デザインの編集元（1024×1024, HTML/CSS）
- `icon-master.png` … 1024×1024 マスター（透過PNG, icon.html を Chrome でラスタライズ）

## 再生成手順（icon.html を編集 → icns まで）
```
# 1) HTML を 1024x1024 透過PNG にラスタライズ
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd build
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --default-background-color=00000000 --window-size=1024,1024 \
  --screenshot="$PWD/icon-master.png" "file://$PWD/icon.html"

# 2) 全サイズ iconset を作って icns 化
mkdir icon.iconset
for e in 16:icon_16x16 32:icon_16x16@2x 32:icon_32x32 64:icon_32x32@2x \
         128:icon_128x128 256:icon_128x128@2x 256:icon_256x256 512:icon_256x256@2x \
         512:icon_512x512 1024:icon_512x512@2x; do
  sips -z "${e%%:*}" "${e%%:*}" icon-master.png --out "icon.iconset/${e##*:}.png"
done
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset
```
