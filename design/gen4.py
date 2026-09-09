from build import HEAD, FOOT, write

def mshell(body, active="Bake"):
    ICONS = {
        "Bake": '<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="@C" stroke-width="1.7"/><circle cx="9.4" cy="9.9" r="1.25" fill="@C"/><circle cx="14.4" cy="12.5" r="1" fill="@C"/></svg>',
        "Airdrop": '<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M12 4v11M7.8 10.8L12 15l4.2-4.2" stroke="@C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="@C" stroke-width="1.8" stroke-linecap="round"/></svg>',
        "Oven": '<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4 19V10M10 19V5M16 19v-6" stroke="@C" stroke-width="1.8" stroke-linecap="round"/><path d="M21 19H3" stroke="@C" stroke-width="1.8" stroke-linecap="round"/></svg>',
    }
    tabs = []
    for name in ("Bake", "Airdrop", "Oven"):
        c = "#E8A33D" if name == active else "#57504A"
        tabs.append(
            '<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; '
            'justify-content: center; gap: 5px; height: 100%;">'
            + ICONS[name].replace("@C", c)
            + '<span style="font-size: 10.5px; font-weight: 600; color: ' + c + ';">' + name + '</span>'
            + '</div>')
    return (HEAD + '''
<div style="width: 390px; height: 844px; background: #0F0D0B; background-image: radial-gradient(360px 200px at 50% -4%, rgba(232,163,61,0.12), transparent 72%); display: flex; flex-direction: column;">
  ''' + body + '''
  <div style="height: 74px; display: flex; align-items: flex-start; padding-top: 10px; border-top: 1px solid #211D19; background: #121010;">
    ''' + "".join(tabs) + '''
  </div>
</div>
''' + FOOT)

MHEADER = '''<div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 12px;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9.25" stroke="#E8A33D" stroke-width="1.5"/>
        <circle cx="9.2" cy="9.6" r="1.35" fill="#E8A33D"/>
        <circle cx="14.6" cy="12.4" r="1.1" fill="#E8A33D"/>
      </svg>
      <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 15.5px; font-weight: 700; letter-spacing: -0.02em;">Cookie Bakery</span>
    </div>
    <div style="display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 11px; background: #171412; border: 1px solid #241F1B; border-radius: 999px;">
      <span style="width: 6px; height: 6px; border-radius: 999px; background: #5FBF8C;"></span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #F5F0E8;">6MGL&#8230;zRQa</span>
    </div>
  </div>'''

# ---------------------------------------------------------------- Mobile Bake
mbake = MHEADER + '''
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 6px 18px 18px; overflow: hidden;">

    <div style="display: flex; flex-direction: column; gap: 5px;">
      <span style="font-size: 12px; color: #6E665C;">Balance</span>
      <div style="display: flex; align-items: baseline; gap: 8px;">
        <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 38px; font-weight: 700; letter-spacing: -0.035em; font-variant-numeric: tabular-nums;">5,140.46</span>
        <span style="font-size: 15px; font-weight: 600; color: #6E665C;">COOK</span>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 14px; padding: 18px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
      <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 19px; font-weight: 700; letter-spacing: -0.02em;">Bake a token</span>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Name</label>
        <div style="height: 48px; display: flex; align-items: center; padding: 0 14px; background: #0F0D0B; border: 1px solid #2A2521; border-radius: 13px; font-size: 15px;">Bakery Cookie</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Symbol</label>
          <div style="height: 48px; display: flex; align-items: center; padding: 0 14px; background: #0F0D0B; border: 1px solid #2A2521; border-radius: 13px; font-family: 'JetBrains Mono', monospace; font-size: 14.5px;">BAKE</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Decimals</label>
          <div style="height: 48px; display: flex; align-items: center; padding: 0 14px; background: #0F0D0B; border: 1px solid #2A2521; border-radius: 13px; font-family: 'JetBrains Mono', monospace; font-size: 14.5px;">6</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Initial supply</label>
        <div style="height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; background: #0F0D0B; border: 1px solid #2A2521; border-radius: 13px;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 14.5px; font-variant-numeric: tabular-nums;">1,000,000</span>
          <span style="font-size: 12.5px; color: #57504A;">BAKE</span>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 14px; background: #0F0D0B; border: 1px solid #211D19; border-radius: 13px;">
        <span style="font-size: 14px; font-weight: 500; color: #A39B8F;">Advanced options</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#57504A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: rgba(232,163,61,0.05); border: 1px solid rgba(232,163,61,0.18); border-radius: 15px;">
      <span style="font-size: 13px; color: #A39B8F;">Estimated cost</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; color: #E8A33D; font-variant-numeric: tabular-nums;">0.00527 COOK</span>
    </div>

    <div style="height: 54px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #E8A33D; border-radius: 15px; color: #1A1410; font-size: 16px; font-weight: 700; box-shadow: 0 12px 30px -14px rgba(232,163,61,0.6);">
      Review transaction
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>

  </div>'''

# ---------------------------------------------------------------- Mobile Review
mreview = MHEADER + '''
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px; padding: 6px 18px 18px; overflow: hidden;">

    <div style="display: flex; flex-direction: column; gap: 4px;">
      <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 24px; font-weight: 700; letter-spacing: -0.03em;">Before you sign</span>
      <span style="font-size: 12.5px; color: #6E665C;">Simulated &#183; nothing sent yet</span>
    </div>

    <div style="display: flex; align-items: center; gap: 13px; padding: 16px; background: #171412; border: 1px solid #241F1B; border-radius: 18px;">
      <div style="width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #E8A33D, #C9781F); border-radius: 14px; font-family: 'Bricolage Grotesque', system-ui; font-size: 16px; font-weight: 800; color: #1A1410;">BA</div>
      <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;">
        <span style="font-size: 15px; font-weight: 600;">Bakery Cookie</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #6E665C;">856T&#8230;SdGt</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
        <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums;">1,000,000</span>
        <span style="font-size: 11px; color: #6E665C;">BAKE</span>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; padding: 4px 18px; background: #171412; border: 1px solid #241F1B; border-radius: 18px;">
      <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 13px 0; border-bottom: 1px solid #1E1A17;">
        <span style="font-size: 13px; color: #A39B8F;">Mint rent</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-variant-numeric: tabular-nums;">0.00322248</span>
      </div>
      <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 13px 0; border-bottom: 1px solid #1E1A17;">
        <span style="font-size: 13px; color: #A39B8F;">Token account rent</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-variant-numeric: tabular-nums;">0.00203928</span>
      </div>
      <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 13px 0; border-bottom: 1px solid #1E1A17;">
        <span style="font-size: 13px; color: #A39B8F;">Network fee</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-variant-numeric: tabular-nums;">0.00001000</span>
      </div>
      <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 14px 0;">
        <span style="font-size: 14px; font-weight: 600;">Total</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 600; color: #E8A33D; font-variant-numeric: tabular-nums;">0.00527176</span>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 10px; padding: 13px 15px; background: #171412; border: 1px solid #241F1B; border-radius: 15px;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#5FBF8C" stroke-width="1.5"/><path d="M8.5 12.3l2.4 2.4 4.6-4.9" stroke="#5FBF8C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span style="flex-grow: 1; font-size: 12.5px; color: #A39B8F;">Simulation passed</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #57504A;">6 instructions</span>
    </div>

    <div style="flex-grow: 1;"></div>

    <div style="display: flex; flex-direction: column; gap: 9px;">
      <div style="height: 54px; display: flex; align-items: center; justify-content: center; gap: 9px; background: #E8A33D; border-radius: 15px; color: #1A1410; font-size: 16px; font-weight: 700; box-shadow: 0 12px 30px -14px rgba(232,163,61,0.6);">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 11V8a5 5 0 0110 0v3" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round"/><rect x="5" y="11" width="14" height="9" rx="2.5" stroke="#1A1410" stroke-width="1.9"/></svg>
        Bake token
      </div>
      <span style="text-align: center; font-size: 11.5px; color: #57504A;">Nightly signs &#183; the app submits to Cookie Chain</span>
    </div>

  </div>'''

# ---------------------------------------------------------------- Mobile Success
msuccess = MHEADER + '''
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 14px 18px 18px; overflow: hidden;">

    <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px 18px 24px; background: #171412; border: 1px solid #241F1B; border-radius: 22px; background-image: radial-gradient(300px 150px at 50% 0%, rgba(95,191,140,0.12), transparent 72%);">
      <div style="width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; background: rgba(95,191,140,0.12); border: 1px solid rgba(95,191,140,0.28); border-radius: 19px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#5FBF8C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center;">
        <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 22px; font-weight: 700; letter-spacing: -0.03em;">Bakery Cookie is live</span>
        <span style="font-size: 13px; color: #A39B8F;">1,000,000 BAKE minted in 1.8s</span>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; padding: 4px 18px; background: #171412; border: 1px solid #241F1B; border-radius: 18px;">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #1E1A17;">
        <span style="font-size: 13px; color: #A39B8F;">Mint</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px;">856T&#8230;SdGt</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2.2" stroke="#6E665C" stroke-width="1.6"/><path d="M15 6.5A2.5 2.5 0 0012.5 4h-6A2.5 2.5 0 004 6.5v6A2.5 2.5 0 006.5 15" stroke="#6E665C" stroke-width="1.6"/></svg>
        </div>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0;">
        <span style="font-size: 13px; color: #A39B8F;">Transaction</span>
        <a href="#" style="display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 12.5px;">4BEoRs&#8230;zuUxg
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8" stroke="#E8A33D" stroke-width="1.8" stroke-linecap="round"/></svg>
        </a>
      </div>
    </div>

    <div style="flex-grow: 1;"></div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="height: 54px; display: flex; align-items: center; justify-content: center; gap: 9px; background: #E8A33D; border-radius: 15px; color: #1A1410; font-size: 16px; font-weight: 700;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 18.5h15" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round"/></svg>
        Airdrop it
      </div>
      <div style="height: 50px; display: flex; align-items: center; justify-content: center; background: #1E1A17; border: 1px solid #2A2521; border-radius: 15px; color: #F5F0E8; font-size: 15px; font-weight: 600;">
        Bake another
      </div>
    </div>

  </div>'''

for name, body, active in (("MobileBake", mbake, "Bake"),
                           ("MobileReview", mreview, "Bake"),
                           ("MobileSuccess", msuccess, "Bake")):
    write(name + ".dc.html", mshell(body, active))
