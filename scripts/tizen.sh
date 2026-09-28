#!/bin/sh
# Build, package, install and launch the app on the Samsung TV.
#   sh scripts/tizen.sh            build + package + install + launch
#   sh scripts/tizen.sh package    build + package only (writes tizen-build/VelopeTV.wgt)
# Settings (override with environment variables):
#   TIZEN_SDK      Tizen SDK folder              (default ~/tizen-sdk)
#   TV_IP          the TV's address              (default 192.168.1.216)
#   TIZEN_PROFILE  signing profile, which must include the TV's DUID (default Ellery)
set -e
cd "$(dirname "$0")/.."
TIZEN_SDK="${TIZEN_SDK:-$HOME/tizen-sdk}"
TV_IP="${TV_IP:-192.168.1.216}"
TIZEN_PROFILE="${TIZEN_PROFILE:-Ellery}"
TIZEN="$TIZEN_SDK/tools/ide/bin/tizen"
SDB="$TIZEN_SDK/tools/sdb"
APP_ID="VelSamsung.VelopeTV"

pnpm build
rm -rf tizen-build
cp -R dist tizen-build
cp tizen/config.xml tizen/icon.png tizen-build/
cp -R tizen/splash tizen-build/splash
"$TIZEN" package -t wgt -s "$TIZEN_PROFILE" -- "$PWD/tizen-build"
mv tizen-build/*.wgt tizen-build/VelopeTV.wgt 2>/dev/null || true
echo "Packaged tizen-build/VelopeTV.wgt"
[ "$1" = "package" ] && exit 0

"$SDB" connect "$TV_IP" >/dev/null 2>&1 || true
if ! "$SDB" devices | grep -q "$TV_IP"; then
  echo "The TV is not connected. Check Developer Mode is on, then run: $SDB connect $TV_IP"
  echo "(On macOS, if sdb cannot reach the TV, start it once from the Terminal app: Local Network permission.)"
  exit 1
fi
"$TIZEN" install -n VelopeTV.wgt -s "$TV_IP:26101" -- "$PWD/tizen-build"
"$TIZEN" run -p "$APP_ID" -s "$TV_IP:26101"
