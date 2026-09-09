from build import shell, write

# ---------------------------------------------------------------- My tokens
def row(initials, grad, name, symbol, mint, supply, program, when, last=False):
    border = "" if last else "border-bottom: 1px solid #1E1A17;"
    tag_bg, tag_fg = ("rgba(232,163,61,0.12)", "#E8A33D") if program == "Token-2022" else ("#221D19", "#A39B8F")
    return '''<div style="display: flex; align-items: center; gap: 14px; padding: 16px 0; %s">
          <div style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: %s; border-radius: 13px; font-family: 'Bricolage Grotesque', system-ui; font-size: 15px; font-weight: 800; color: #1A1410;">%s</div>
          <div style="width: 210px; display: flex; flex-direction: column; gap: 3px;">
            <span style="font-size: 14.5px; font-weight: 600;">%s</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #6E665C;">%s</span>
          </div>
          <span style="flex-grow: 1; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #57504A;">%s</span>
          <span style="padding: 4px 10px; background: %s; border-radius: 999px; font-size: 11px; font-weight: 600; color: %s;">%s</span>
          <span style="width: 130px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">%s</span>
          <span style="width: 80px; text-align: right; font-size: 12.5px; color: #57504A;">%s</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#3A332C" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>''' % (border, grad, initials, name, symbol, mint, tag_bg, tag_fg, program, supply, when)

mytokens = '''<div style="flex-grow: 1; display: flex; justify-content: center; padding: 40px 32px; overflow: hidden;">
    <div style="width: 900px; display: flex; flex-direction: column; gap: 22px;">

      <div style="display: flex; align-items: flex-end; justify-content: space-between;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 32px; font-weight: 700; letter-spacing: -0.03em;">My tokens</h1>
          <p style="margin: 0; font-size: 14px; color: #6E665C;">Stored on this device &#183; 3 mints created from this browser</p>
        </div>
        <div style="height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 18px; background: #E8A33D; border-radius: 12px; color: #1A1410; font-size: 14px; font-weight: 700;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#1A1410" stroke-width="2" stroke-linecap="round"/></svg>
          Bake a token
        </div>
      </div>

      <div style="display: flex; flex-direction: column; padding: 6px 22px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
        <div style="display: flex; align-items: center; gap: 14px; padding: 12px 0 10px; border-bottom: 1px solid #241F1B;">
          <span style="width: 42px;"></span>
          <span style="width: 210px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Token</span>
          <span style="flex-grow: 1; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Mint</span>
          <span style="width: 78px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Program</span>
          <span style="width: 130px; text-align: right; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Supply</span>
          <span style="width: 80px; text-align: right; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Created</span>
          <span style="width: 18px;"></span>
        </div>
        ''' + row("BA", "linear-gradient(145deg, #E8A33D, #C9781F)", "Bakery Cookie", "BAKE", "856TqPXn&#8230;Nd7eSdGt", "1,000,000", "Token-2022", "just now") + '''
        ''' + row("CR", "linear-gradient(145deg, #C98B5E, #8A5230)", "Crumb", "CRMB", "3xQvR9Lm&#8230;Kp2WbYzT", "250,000", "Token-2022", "2 days ago") + '''
        ''' + row("LG", "linear-gradient(145deg, #7E8B6F, #4C5742)", "Legacy Test", "LGCY", "9fBzUa4N&#8230;R2vY8mLw", "10,000", "SPL Token", "5 days ago", last=True) + '''
      </div>

      <div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: rgba(232,163,61,0.04); border: 1px dashed rgba(232,163,61,0.22); border-radius: 16px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#E8A33D" stroke-width="1.5"/><path d="M12 11v5M12 8h.01" stroke="#E8A33D" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span style="flex-grow: 1; font-size: 13px; color: #A39B8F;">This list lives in your browser. Clearing site data removes it &#8212; the mints stay on-chain.</span>
        <span style="font-size: 13px; font-weight: 600; color: #E8A33D;">Export CSV</span>
      </div>

    </div>
  </div>'''

# ---------------------------------------------------------------- Airdrop
def csvrow(addr, amount, state, last=False):
    border = "" if last else "border-bottom: 1px solid #1E1A17;"
    if state == "ok":
        badge = '<span style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #5FBF8C;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#5FBF8C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Valid</span>'
        ata = '<span style="font-size: 12px; color: #57504A;">ATA exists</span>'
    elif state == "new":
        badge = '<span style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #5FBF8C;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#5FBF8C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Valid</span>'
        ata = '<span style="padding: 3px 8px; background: rgba(232,163,61,0.12); border-radius: 6px; font-size: 11px; font-weight: 600; color: #E8A33D;">+ ATA</span>'
    else:
        badge = '<span style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #E2685F;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#E2685F" stroke-width="1.7"/><path d="M12 8v4.5M12 15.5h.01" stroke="#E2685F" stroke-width="2" stroke-linecap="round"/></svg>Bad base58</span>'
        ata = ''
    bg = "background: rgba(226,104,95,0.05);" if state == "bad" else ""
    return '''<div style="display: flex; align-items: center; gap: 14px; padding: 11px 12px; %s %s">
          <span style="width: 26px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #4A443E;">%s</span>
          <span style="flex-grow: 1; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: %s;">%s</span>
          <span style="width: 80px;">%s</span>
          <span style="width: 110px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">%s</span>
          <span style="width: 116px; text-align: right;">%s</span>
        </div>''' % (border, bg, csvrow.n, "#E2685F" if state == "bad" else "#F5F0E8", addr, ata, amount, badge)
csvrow.n = 0

def numbered(addr, amount, state, last=False):
    csvrow.n += 1
    return csvrow(addr, amount, state, last)

airdrop = '''<div style="flex-grow: 1; display: flex; justify-content: center; padding: 34px 32px; overflow: hidden;">
    <div style="width: 1080px; display: flex; gap: 20px;">

      <div style="width: 660px; display: flex; flex-direction: column; gap: 18px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 30px; font-weight: 700; letter-spacing: -0.03em;">Airdrop</h1>
          <p style="margin: 0; font-size: 14px; color: #6E665C;">Paste <span style="font-family: 'JetBrains Mono', monospace; color: #A39B8F;">address,amount</span> or drop a CSV &#183; up to 1,000 rows</p>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #171412; border: 1px solid #241F1B; border-radius: 16px;">
          <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #E8A33D, #C9781F); border-radius: 12px; font-family: 'Bricolage Grotesque', system-ui; font-size: 13px; font-weight: 800; color: #1A1410;">BA</div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 14px; font-weight: 600;">Bakery Cookie &#183; BAKE</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #6E665C;">856TqPXn&#8230;Nd7eSdGt &#183; balance 1,000,000</span>
          </div>
          <span style="padding: 7px 14px; background: #1E1A17; border: 1px solid #2A2521; border-radius: 10px; font-size: 12.5px; font-weight: 600; color: #A39B8F;">Change</span>
        </div>

        <div style="flex-grow: 1; display: flex; flex-direction: column; background: #171412; border: 1px solid #241F1B; border-radius: 18px; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 14px; padding: 12px 12px; border-bottom: 1px solid #241F1B;">
            <span style="width: 26px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">#</span>
            <span style="flex-grow: 1; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Recipient</span>
            <span style="width: 80px;"></span>
            <span style="width: 110px; text-align: right; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Amount</span>
            <span style="width: 116px; text-align: right; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Status</span>
          </div>
          ''' + numbered("7pKfR2mNvQ8xLwHc9fBzUa4Nd7eSdGtY3jM", "12,500", "ok") + '''
          ''' + numbered("3xQvR9LmKp2WbYzT8nHgD4sVc6RfXeAu1Bq", "8,000", "new") + '''
          ''' + numbered("9fBzUa4NR2vY8mLwHc7pKfQ3jMnGtS5dEwX", "8,000", "ok") + '''
          ''' + numbered("0OIl1invalidbase58address000zzz", "4,200", "bad") + '''
          ''' + numbered("Bq4sVc6RfXeAu1D8nHgYzT2WbKp9LmQvR3x", "1,000", "new", last=True) + '''
        </div>
      </div>

      <div style="width: 400px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; flex-direction: column; gap: 14px; padding: 20px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
          <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Execution plan</span>
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 14px; background: #0F0D0B; border: 1px solid #211D19; border-radius: 14px;">
              <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em;">4</span>
              <span style="font-size: 12px; color: #6E665C;">recipients</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 14px; background: #0F0D0B; border: 1px solid #211D19; border-radius: 14px;">
              <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; color: #E2685F;">1</span>
              <span style="font-size: 12px; color: #6E665C;">row with errors</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 9px;">
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 13px; color: #A39B8F;">Transactions</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">1 &#215; 8 per batch</span>
            </div>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 13px; color: #A39B8F;">New token accounts</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">2</span>
            </div>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 13px; color: #A39B8F;">Total to send</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">29,500 BAKE</span>
            </div>
            <div style="height: 1px; margin: 3px 0; background: #241F1B;"></div>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 13.5px; font-weight: 600;">Estimated cost</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 14.5px; font-weight: 600; color: #E8A33D; font-variant-numeric: tabular-nums;">0.00408856</span>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; padding: 20px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
          <div style="display: flex; align-items: baseline; justify-content: space-between;">
            <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Progress</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #A39B8F; font-variant-numeric: tabular-nums;">0 / 1</span>
          </div>
          <div style="height: 6px; background: #221D19; border-radius: 999px; overflow: hidden;">
            <div style="width: 0%; height: 6px; background: #E8A33D;"></div>
          </div>
          <span style="font-size: 12.5px; color: #57504A;">Fix the invalid row to continue. Batches sign one at a time with a fresh blockhash.</span>
        </div>

        <div style="height: 52px; display: flex; align-items: center; justify-content: center; gap: 9px; background: #221D19; border: 1px solid #2A2521; border-radius: 14px; color: #57504A; font-size: 15px; font-weight: 700;">
          Send airdrop
        </div>
      </div>

    </div>
  </div>'''

write("MyTokens.dc.html", shell(mytokens, active="Bake"))
write("Airdrop.dc.html", shell(airdrop, active="Airdrop"))
