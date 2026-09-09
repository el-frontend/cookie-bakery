from build import shell, write

# ---------------------------------------------------------------- Connect
connect = '''<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 32px;">
    <div style="width: 520px; display: flex; flex-direction: column; align-items: center; gap: 28px; text-align: center;">

      <div style="width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; background: #171412; border: 1px solid #2A2521; border-radius: 28px; box-shadow: 0 24px 60px -30px rgba(232,163,61,0.5);">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.25" stroke="#E8A33D" stroke-width="1.4"/>
          <circle cx="9.2" cy="9.6" r="1.35" fill="#E8A33D"/>
          <circle cx="14.6" cy="12.4" r="1.1" fill="#E8A33D"/>
          <circle cx="10" cy="15.2" r="1" fill="#E8A33D"/>
        </svg>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 40px; font-weight: 700; letter-spacing: -0.035em; line-height: 1.08;">Launch a token on<br>Cookie Chain</h1>
        <p style="margin: 0; font-size: 15px; line-height: 1.55; color: #A39B8F;">Create a Token-2022 mint with metadata, airdrop it from a CSV,<br>and watch it land &#8212; without touching a CLI.</p>
      </div>

      <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: #171412; border: 1px solid #2A2521; border-radius: 16px;">
          <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #221D19; border-radius: 12px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3l7.5 4.2v9.6L12 21l-7.5-4.2V7.2L12 3z" stroke="#E8A33D" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; text-align: left;">
            <span style="font-size: 14.5px; font-weight: 600;">Nightly</span>
            <span style="font-size: 12.5px; color: #6E665C;">Detected &#183; recommended</span>
          </div>
          <span style="padding: 8px 16px; background: #E8A33D; border-radius: 10px; color: #1A1410; font-size: 13px; font-weight: 700;">Connect</span>
        </div>

        <div style="display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: #14110F; border: 1px solid #211D19; border-radius: 16px;">
          <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #1B1714; border-radius: 12px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#57504A" stroke-width="1.5"/></svg>
          </div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; text-align: left;">
            <span style="font-size: 14.5px; font-weight: 600; color: #A39B8F;">Other Wallet Standard wallets</span>
            <span style="font-size: 12.5px; color: #57504A;">Shown when discovered for this chain</span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: rgba(232,163,61,0.05); border: 1px solid rgba(232,163,61,0.16); border-radius: 12px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#E8A33D" stroke-width="1.5"/><path d="M12 11v5M12 8h.01" stroke="#E8A33D" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span style="font-size: 13px; color: #A39B8F;">You need COOK for rent and fees. <a href="#">Bridge from Solana</a></span>
      </div>

    </div>
  </div>'''

# ---------------------------------------------------------------- Review
review = '''<div style="flex-grow: 1; display: flex; justify-content: center; padding: 40px 32px; overflow: hidden;">
    <div style="width: 560px; display: flex; flex-direction: column; gap: 20px;">

      <div style="display: flex; align-items: center; gap: 12px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#A39B8F" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 28px; font-weight: 700; letter-spacing: -0.03em;">Before you sign</h1>
          <p style="margin: 0; font-size: 13.5px; color: #6E665C;">Simulated against Cookie Chain &#183; nothing has been sent yet</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 2px; padding: 22px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid #241F1B;">
          <div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #E8A33D, #C9781F); border-radius: 14px; font-family: 'Bricolage Grotesque', system-ui; font-size: 17px; font-weight: 800; color: #1A1410;">BA</div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px; font-weight: 600;">Bakery Cookie</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #6E665C;">BAKE &#183; 6 decimals</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
            <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em;">1,000,000</span>
            <span style="font-size: 11.5px; color: #6E665C;">initial supply</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #1E1A17;">
          <span style="font-size: 13.5px; color: #A39B8F;">Mint address</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #F5F0E8;">856T&#8230;SdGt</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #1E1A17;">
          <span style="font-size: 13.5px; color: #A39B8F;">Token program</span>
          <span style="padding: 4px 10px; background: rgba(232,163,61,0.12); border-radius: 999px; font-size: 11.5px; font-weight: 600; color: #E8A33D;">Token-2022</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0;">
          <span style="font-size: 13.5px; color: #A39B8F;">Authorities</span>
          <span style="font-size: 13px; color: #F5F0E8;">Freeze revoked &#183; mint kept</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; padding: 20px 22px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
        <span style="margin-bottom: 14px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;">Cost breakdown</span>
        <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0;">
          <span style="font-size: 13.5px; color: #A39B8F;">Mint rent <span style="color: #57504A;">335 bytes</span></span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">0.00322248</span>
        </div>
        <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0;">
          <span style="font-size: 13.5px; color: #A39B8F;">Token account rent <span style="color: #57504A;">165 bytes</span></span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">0.00203928</span>
        </div>
        <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0 14px; border-bottom: 1px solid #241F1B;">
          <span style="font-size: 13.5px; color: #A39B8F;">Network fee <span style="color: #57504A;">2 signatures</span></span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-variant-numeric: tabular-nums;">0.00001000</span>
        </div>
        <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 14px 0 7px;">
          <span style="font-size: 14.5px; font-weight: 600;">Total</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 600; color: #E8A33D; font-variant-numeric: tabular-nums;">0.00527176 COOK</span>
        </div>
        <div style="display: flex; align-items: baseline; justify-content: space-between;">
          <span style="font-size: 12.5px; color: #57504A;">Your balance</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #6E665C; font-variant-numeric: tabular-nums;">5,140.466217 COOK</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="height: 52px; display: flex; align-items: center; justify-content: center; gap: 9px; background: #E8A33D; border-radius: 14px; color: #1A1410; font-size: 15px; font-weight: 700; box-shadow: 0 10px 30px -12px rgba(232,163,61,0.55);">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 11V8a5 5 0 0110 0v3" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round"/><rect x="5" y="11" width="14" height="9" rx="2.5" stroke="#1A1410" stroke-width="1.9"/></svg>
          Bake token
        </div>
        <span style="text-align: center; font-size: 12.5px; color: #57504A;">Nightly will ask you to sign &#183; the app submits to rpc.cookiescan.io</span>
      </div>

    </div>
  </div>'''

# ---------------------------------------------------------------- Success
success = '''<div style="flex-grow: 1; display: flex; justify-content: center; padding: 44px 32px; overflow: hidden;">
    <div style="width: 560px; display: flex; flex-direction: column; gap: 22px;">

      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 30px 24px 26px; background: #171412; border: 1px solid #241F1B; border-radius: 22px; background-image: radial-gradient(420px 180px at 50% 0%, rgba(95,191,140,0.10), transparent 72%);">
        <div style="width: 62px; height: 62px; display: flex; align-items: center; justify-content: center; background: rgba(95,191,140,0.12); border: 1px solid rgba(95,191,140,0.28); border-radius: 20px;">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#5FBF8C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 28px; font-weight: 700; letter-spacing: -0.03em;">Bakery Cookie is live</h1>
          <p style="margin: 0; font-size: 14px; color: #A39B8F;">1,000,000 BAKE minted to your token account in 1.8s</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; padding: 4px 22px; background: #171412; border: 1px solid #241F1B; border-radius: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid #1E1A17;">
          <span style="font-size: 13.5px; color: #A39B8F;">Mint</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #F5F0E8;">856TqPXn3kR2vY8mLwHc9fBzUa4Nd7eSdGt</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2.2" stroke="#6E665C" stroke-width="1.6"/><path d="M15 6.5A2.5 2.5 0 0012.5 4h-6A2.5 2.5 0 004 6.5v6A2.5 2.5 0 006.5 15" stroke="#6E665C" stroke-width="1.6"/></svg>
          </div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #1E1A17;">
          <span style="font-size: 13.5px; color: #A39B8F;">Transaction</span>
          <a href="#" style="display: flex; align-items: center; gap: 7px; font-family: 'JetBrains Mono', monospace; font-size: 12.5px;">4BEoRs&#8230;zuUxg
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8" stroke="#E8A33D" stroke-width="1.7" stroke-linecap="round"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" stroke="#E8A33D" stroke-width="1.7" stroke-linecap="round"/></svg>
          </a>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 0;">
          <span style="font-size: 13.5px; color: #A39B8F;">Program</span>
          <span style="padding: 4px 10px; background: rgba(232,163,61,0.12); border-radius: 999px; font-size: 11.5px; font-weight: 600; color: #E8A33D;">Token-2022</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
        <div style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 9px; background: #E8A33D; border-radius: 14px; color: #1A1410; font-size: 14.5px; font-weight: 700;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 18.5h15" stroke="#1A1410" stroke-width="1.9" stroke-linecap="round"/></svg>
          Airdrop it
        </div>
        <div style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 9px; background: #1E1A17; border: 1px solid #2A2521; border-radius: 14px; color: #F5F0E8; font-size: 14.5px; font-weight: 600;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" stroke="#F5F0E8" stroke-width="1.8" stroke-linecap="round"/></svg>
          View in Oven
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 13px; color: #6E665C;">
        <span>Saved to</span><span style="color: #A39B8F; font-weight: 600;">My tokens</span><span>on this device</span>
      </div>

    </div>
  </div>'''

write("Connect.dc.html", shell(connect, active="Bake", connected=False))
write("Review.dc.html", shell(review, active="Bake"))
write("Success.dc.html", shell(success, active="Bake"))
