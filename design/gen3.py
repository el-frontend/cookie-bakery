from build import shell, write

def bar(rank, addr, pct, px, other=False):
    fill = "#4A443E" if other else "#E8A33D"
    ink = "#6E665C" if other else "#F5F0E8"
    label = "Other &#183; 37 holders" if other else addr
    font = "'Instrument Sans', sans-serif" if other else "'JetBrains Mono', monospace"
    return '''<div style="display: flex; align-items: center; gap: 14px; padding: 5px 0;">
            <span style="width: 18px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #4A443E; font-variant-numeric: tabular-nums;">%s</span>
            <span style="width: 132px; font-family: %s; font-size: 12.5px; color: %s;">%s</span>
            <div style="flex-grow: 1; display: flex; align-items: center; gap: 10px;">
              <div style="width: %dpx; height: 14px; background: %s; border-radius: 0 4px 4px 0;"></div>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #A39B8F; font-variant-numeric: tabular-nums;">%s%%</span>
            </div>
          </div>''' % (rank, font, ink, label, px, fill, pct)

def tile(label, value, sub, accent=False):
    color = "#E8A33D" if accent else "#F5F0E8"
    return '''<div style="display: flex; flex-direction: column; gap: 6px; padding: 18px; background: #171412; border: 1px solid #241F1B; border-radius: 18px;">
          <span style="font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">%s</span>
          <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 27px; font-weight: 700; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; color: %s;">%s</span>
          <span style="font-size: 12px; color: #6E665C;">%s</span>
        </div>''' % (label, color, value, sub)

def histrow(when, rows, amount, sig, last=False):
    border = "" if last else "border-bottom: 1px solid #1E1A17;"
    return '''<div style="display: flex; align-items: center; gap: 14px; padding: 13px 0; %s">
            <div style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: rgba(95,191,140,0.10); border-radius: 9px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#5FBF8C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;">
              <span style="font-size: 13.5px; font-weight: 500;">%s recipients</span>
              <span style="font-size: 11.5px; color: #57504A;">%s</span>
            </div>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">%s</span>
            <a href="#" style="width: 92px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px;">%s</a>
          </div>''' % (border, rows, when, amount, sig)

oven = '''<div style="flex-grow: 1; display: flex; justify-content: center; padding: 30px 32px; overflow: hidden;">
    <div style="width: 1120px; display: flex; flex-direction: column; gap: 16px;">

      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #E8A33D, #C9781F); border-radius: 16px; font-family: 'Bricolage Grotesque', system-ui; font-size: 18px; font-weight: 800; color: #1A1410;">BA</div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 26px; font-weight: 700; letter-spacing: -0.03em;">Bakery Cookie</h1>
            <span style="padding: 4px 10px; background: rgba(232,163,61,0.12); border-radius: 999px; font-size: 11px; font-weight: 600; color: #E8A33D;">Token-2022</span>
            <span style="padding: 4px 10px; background: #1E1A17; border-radius: 999px; font-size: 11px; font-weight: 600; color: #A39B8F;">Metadata</span>
          </div>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #6E665C;">856TqPXn3kR2vY8mLwHc9fBzUa4Nd7eSdGt</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <span style="height: 40px; display: flex; align-items: center; gap: 7px; padding: 0 15px; background: #1E1A17; border: 1px solid #2A2521; border-radius: 11px; font-size: 13px; font-weight: 600; color: #F5F0E8;">Airdrop more</span>
          <span style="height: 40px; display: flex; align-items: center; gap: 7px; padding: 0 15px; background: #1E1A17; border: 1px solid #2A2521; border-radius: 11px; font-size: 13px; font-weight: 600; color: #F5F0E8;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8" stroke="#A39B8F" stroke-width="1.7" stroke-linecap="round"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" stroke="#A39B8F" stroke-width="1.7" stroke-linecap="round"/></svg>
            CookieScan
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
        ''' + tile("Total supply", "1,000,000", "6 decimals", accent=True) + '''
        ''' + tile("Holders", "45", "+8 in the last airdrop") + '''
        ''' + tile("Mint authority", "Held", "you can still mint") + '''
        ''' + tile("Freeze authority", "Revoked", "cannot be frozen") + '''
      </div>

      <div style="display: flex; gap: 16px;">
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px; padding: 20px 22px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
          <div style="display: flex; align-items: baseline; justify-content: space-between;">
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <span style="font-size: 14.5px; font-weight: 600;">Holder distribution</span>
              <span style="font-size: 12px; color: #57504A;">Share of supply &#183; top 8 of 45, via CookieScan DAS</span>
            </div>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #4A443E;">% of 1,000,000</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            ''' + bar(1, "7pKf&#8230;dGtY", "42.5", 340) + '''
            ''' + bar(2, "3xQv&#8230;YzT8", "18.2", 146) + '''
            ''' + bar(3, "9fBz&#8230;mLwH", "11.4", 91) + '''
            ''' + bar(4, "Bq4s&#8230;QvR3", "7.9", 63) + '''
            ''' + bar(5, "Dn8H&#8230;Kp9L", "5.6", 45) + '''
            ''' + bar(6, "Xe1A&#8230;u1D8", "4.1", 33) + '''
            ''' + bar(7, "Rf6V&#8230;c6Rf", "2.8", 22) + '''
            ''' + bar(8, "Zt2W&#8230;bKp9", "1.9", 15) + '''
            <div style="height: 1px; margin: 7px 0; background: #211D19;"></div>
            ''' + bar("&#8211;", "", "5.6", 45, other=True) + '''
          </div>
        </div>

        <div style="width: 380px; display: flex; flex-direction: column; gap: 12px; padding: 20px 22px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="font-size: 14.5px; font-weight: 600;">Airdrop history</span>
            <span style="font-size: 12px; color: #57504A;">Recorded on this device</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            ''' + histrow("8 Sep 2026 &#183; 00:24", "8", "29,500", "4BEoRs&#8230;") + '''
            ''' + histrow("6 Sep 2026 &#183; 18:02", "24", "180,000", "9QmTvz&#8230;") + '''
            ''' + histrow("6 Sep 2026 &#183; 17:41", "13", "82,400", "2LkWpq&#8230;", last=True) + '''
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 4px; padding: 11px; background: #0F0D0B; border: 1px solid #211D19; border-radius: 12px; font-size: 13px; font-weight: 600; color: #A39B8F;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 15V3M7.5 10.5L12 15l4.5-4.5" stroke="#A39B8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 19.5h15" stroke="#A39B8F" stroke-width="1.8" stroke-linecap="round"/></svg>
            Export results CSV
          </div>
        </div>
      </div>

    </div>
  </div>'''

write("Oven.dc.html", shell(oven, active="Oven"))
