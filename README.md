# BCRoller

![Foundry Version Compatibility](https://img.shields.io/badge/Foundry-v11-informational)
![Foundry Version Compatibility](https://img.shields.io/badge/Foundry-v12-informational)

A module to query the BCDice API for dice rolls. BCDice is the largest dice rolling bot in Japan, containing 100s of different TRPG systems and playstyles.　You can find the sourcecode [here](https://github.com/bcdice/BCDice). Please feel free to join their Discord and discuss your favorite Japanese TRPGs. You can even submit localization files for them.
Alternatively, if you have a system which foundry does not support, you can submit how that system does dice rolls and it can be implemented in BCDice (thus allowing you to use that system in foundry). Currently, the majority of users are from Japan and Korea. Looking forward to seeing others joing the team!

## BCDice
日本でもっとも使われている、TRPG用ダイスロール処理システムです。どどんとふ、ココフォリア、ユドナリウム、TRPGスタジオなどさまざまなオンセツールで使われています。
（https://bcdice.org/ より引用）

Modの使い方は[Wiki](https://foundryvtt.wiki/ja/BCDice)よりご確認ください（jsin_me版の情報）。

サポートは[Wiki](https://foundryvtt.wiki/ja/home)にあるコミュニティDiscordに入り（事前確認不要）、BCDiceチャンネルで要望をご報告ください。

このモジュールは[jsin_me](https://github.com/jsinme/)さんが作製し、[こまる](https://x.com/komaru_5maru)さんが改良したものをベースに作製されています。

## ManifestURL
https://github.com/jeannjeann/fvtt-bcdice-addon/releases/latest/download/module.json

◆モジュールのインストール方法
モッド・拡張機能、モジュールインストール、URLを指定に「ManifestURL」の文字を指定してインストールしてください。

Please specify the letters "ManifestURL" in Mod Extensions, Module Installation, Specify URL and install.

## Custom System Builderとの連携

### 使用方法

「Label roll message」に以下のコードを入力することでBCDiceを経由するロールが可能になります。
```
${#%{localVars.bcdformula=`BCDiceコマンド`}%}$
${#%{localVars.text=await game.modules.get("fvtt-bcdice-addon").api.customCommand("/bcd","",`${bcdformula}$`)}%}$
${#%{localVars.result=`${text}$`.substring(`${text}$`.lastIndexOf("＞ ") + 2)}%}$
```
- BCDiceコマンドの部分を任意のコマンドに置き換えてください。
- BCDiceコマンドの部分には`{}`で括ったチャットパレットの変数に加えて、`${}$`で括ったCustom System Builderの変数も使用できます。
- ダイスロールコマンドの場合、出力結果の全文が`${text}$`に代入され、最後の1項目がロール結果として`${result}$`に代入されます。
  - 自動化は`${result}$`を使用したコードを追加することである程度実現できます。
  - 選択したダイスボットやロール式によっては`${result}$`が特殊な結果になる場合がありますが、その場合はスクリプトやマクロで`${text}$`を整形して利用してください。
- 変数操作コマンドの場合、変数名が`${text}$`に代入され、操作後の値が`${result}$`に代入されます。
- BCDiceの出力結果のみを表示したい場合は「Send roll message to chat」オプションをオフにしてください。
- ロール結果の発言者は現在選択しているトークンになります。キャラクターシートのアクターではないので注意してください。

### 変数同期

設定で「CustomSystemBuilder連携」を有効にすると、BCDiceの変数とCSBの変数の双方向同期を行えるようになります。
- BCDice側の変数は事前に作成しておく必要があります。自動で作成されません。
- 各変数が変更された時に同期する仕組みです。常時監視して同期しているわけではないので注意してください。

同期対象の変数を設定する必要があります。
- 「BCDiceの変数名 : CSBのCompornent key」という「:」区切りの形式で1行ずつ記述します。
- CSB側がDynamicTable内の変数である場合、「BCDiceの変数名:DynamicTableのCommentkey, 判別用FieldのCompornentkey, 同期対象FieldのCompornentkey」となります。

設定例：
```
HP : currenthp
敏捷 : attributes, name_attributes, value_attributes
```
- この例では、以下の2つの変数が同期されます。
  - BCDiceの変数「HP」と、CSBのkey「currenthp」の値
  - BCDiceの変数「敏捷」と、CSBのkey「attributes」のDynamicTable内のkey「name_attributes」欄が「敏捷」である行のkey「value_attributes」欄の値

## Token Action HUD 対応
- [Token Action HUD BCDice](https://foundryvtt.com/packages/token-action-hud-bcdice)に対応（[Token Action HUD Core](https://foundryvtt.com/packages/token-action-hud-core)が必要）

# Changelog

### 4.3.1
- bug fix

### 4.3.0
- Added the function of linking actor macros and token macros
- bug fix

### 4.2.1
- Replacements dialog to resizable
- Remove the label for macros
- bug fix in loading macros when switching tokens

### 4.2.0
- Added function to synchronize variables with Custom System Builder
- Fix replacements control command
- bug fix

### 4.1.1
- Fix replacements control command

### 4.1.0
- Added settings for chat message output of results
- Support replacements control command starting with “:”
- Added autocomplete function in chat command (require "Chat Commander" module)
- Support "Token Action HUD" module

### 4.0.2
- Fixed error in commands starting with “s”
- Fixed dice bot dropdown not immediately reflecting
- The display of BCDice help changed from chat messages to dialogs
- bug fix

### 4.0.1
- Fixed to output return value of roll result
- bug fix

### 4.0.0 - v11 compatibility (developed by Jean.N)
- Forked
- Suppoerted v11 (also works on v12, but with alerts)
- Added custom chat commands ("/bcd" command)
- Added inline roll function ("/bcd" command)
- Added option to separate command and replacements when importing macros
- Changed to output content to chat if formula is invalid

### 3.2.0
- Japanese translation updated.
- Modified to combine dice roll requests and dice roll results into a single chat image.
- Changed the name displayed in chat messages to output the token name instead of the player name.
- Added the ability to display a token icon image to indicate whose die roller screen is being used.
- Added the ability to output color-coded chat damage text for success and failure in die roll results.

### 3.1.5
- Updated translation of "ja.json". If you want to use the original translation file, specify "ja_base.json" in "module.json" and reload it.

### 3.1.4
- Removed one space from the default 'spliter' string on the import screen.
- Added shortcut keys "[Shift]+[Ctrl]+[B]" to be displayed in the tool title of the control bar.
- Fixed to not send a request to the BCDice API server when the roll button is clicked with an empty command value.
- Modified background color, border, and text thickness to make it easier to notice whose die roller (chat palette) it is.

### 3.1.3
- Bugfix a problem in which the "BCDice Dialog" could not be opened unless the user had the "Assistant GM" privilege or higher.

### 3.1.2 (developed by こまる)
- Bugfix Foundry VTT Ver. 10 is now supported.
- removed "/scripts/persistent-dialog.js" from "esmodules".
- Bugfix an issue with the height of the variable conversion dialog at bcdice-dialog.js.
- CompatibleCoreVersion" was updated to "10.291".

### 3.0.1
- Bugfix where header line parsing was not using start-of-string `^` nor end-of-string `$` anchors that caused some incorrect parsing
- Bugfix for importing without any header start nor trim not sending values to Default Header as expected.

### 3.0.0 - V9 compatibility
- Upping mayor version as this is not backward-compatible with versions < V9
- Fixed sidebar icon
- Updated keybindings to use the new Keybindings API
- Added `Formula Persistance` module setting for configuring if the roller should remain after a roll
- Fixed `Roller Persistance` module setting that was present but not working
- Bugfix that prevented the Roll button to work on the first click after changing the formula input
- Bugfix that prevented headers `### ■` that had no header trim values from working.

### 2.0.1
- removed system name from the chat message that contains the commands
- removed system name from the BCdice response, made that into the chat card alias instead
- removed the error message when command is not found
As requested by the Japanese community

### 2.0.0
- Added one-line macro support by Spice King

### 0.4
- Added System Search
- Added Secret Roll Support
- Added Roller Persistance setting
- Bug Fixes

### 0.3 Dice So Nice!
- Added support for DSN

### 0.2.4
- Added localization for Japanese

### 0.2.3
- Changed dice rolling sound to native foundry sound
- Special characters in commands are now escaped properly
- Long single line commands outputs should now wrap properly
- Multi line results will now be properly displayed
- Roller outputs have been reformated for clarity
- Added link to bcdice docs at the top of each System help message

### 0.2.2
- Fixed formatting for System help messages

### 0.2.1
- Added help button to get info on a System
- Added a sound to be played when a roll occurs

### 0.2
- Added keyboard shortcut for launching Roller (Ctrl + Shift + B)
- Browser will focus on the command input field when Roller is brought up
- Roller will not close after submitting a roll
  - Unless "Shift + Enter" is used. Then the Roller will submit the roll, close, and focus the browser on the Chatgit Message input
- Roller will now remember the last selected game system when reopened
- Result chat message will now also contain the original command below the result

### 0.1 (developed by jsin_me)
- BCDice Control in left controls bar
- Roller Application that allows a user to select from a list of available systems, input a command, and submit that command to the api
- Chat Message containing result fo the roll

