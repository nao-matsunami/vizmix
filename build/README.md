# build/ アセット

## icon.icns（仮アイコン / プレースホルダ）

`icon.icns` は **起動確認用の仮アイコン**（自動生成のグラデーション）。
本番アイコンは director 側で素材用意後に同名 `build/icon.icns` を差し替える。
electron-builder は既定で `build/icon.icns` を mac アプリアイコンとして使用する。

差し替え手順（素材 1024x1024 PNG → icns）:
```
mkdir icon.iconset
for s in 16 32 64 128 256 512; do
  sips -z $s $s master.png --out icon.iconset/icon_${s}x${s}.png
  sips -z $((s*2)) $((s*2)) master.png --out icon.iconset/icon_${s}x${s}@2x.png
done
iconutil -c icns icon.iconset -o icon.icns
```
