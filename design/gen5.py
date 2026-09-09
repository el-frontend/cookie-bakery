from build import HEAD, FOOT, write

def swatch(hexv, name, role, dark_text=False):
    ink = "#1A1410" if dark_text else "#F5F0E8"
    return '''<div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="height: 68px; background: %s; border: 1px solid #241F1B; border-radius: 14px; display: flex; align-items: flex-end; padding: 9px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: %s;">%s</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 12.5px; font-weight: 600;">%s</span>
            <span style="font-size: 11.5px; color: #57504A;">%s</span>
          </div>
        </div>''' % (hexv, ink, hexv, name, role)

def typerow(sample, spec, style):
    return '''<div style="display: flex; align-items: baseline; gap: 22px; padding: 11px 0; border-bottom: 1px solid #1E1A17;">
          <span style="width: 300px; %s">%s</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #57504A;">%s</span>
        </div>''' % (style, sample, spec)

foundations = HEAD + '''
<div style="width: 1280px; height: 880px; background: #0F0D0B; padding: 34px 38px; display: flex; flex-direction: column; gap: 22px;">

  <div style="display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 18px; border-bottom: 1px solid #241F1B;">
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <h1 style="margin: 0; font-family: 'Bricolage Grotesque', system-ui; font-size: 30px; font-weight: 700; letter-spacing: -0.03em;">Foundations</h1>
      <p style="margin: 0; font-size: 13.5px; color: #6E665C;">Warm dark bakery &#183; the tokens every screen is built from</p>
    </div>
    <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #4A443E;">v1 &#183; Cookie Bakery</span>
  </div>

  <div style="display: flex; gap: 30px;">

    <div style="width: 620px; display: flex; flex-direction: column; gap: 20px;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Surfaces &amp; ink</span>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
          ''' + swatch("#0F0D0B", "Canvas", "page background") + '''
          ''' + swatch("#171412", "Surface", "cards, top bar") + '''
          ''' + swatch("#1E1A17", "Raised", "secondary buttons") + '''
          ''' + swatch("#2A2521", "Hairline", "borders, dividers") + '''
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
          ''' + swatch("#F5F0E8", "Ink", "primary text", dark_text=True) + '''
          ''' + swatch("#A39B8F", "Ink 2", "secondary text", dark_text=True) + '''
          ''' + swatch("#8C8377", "Ink 3", "labels, captions", dark_text=True) + '''
          ''' + swatch("#6E665C", "Ink 4", "placeholders", dark_text=True) + '''
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Accent &amp; status</span>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
          ''' + swatch("#E8A33D", "Caramel", "the single accent", dark_text=True) + '''
          ''' + swatch("#5FBF8C", "Success", "confirmed", dark_text=True) + '''
          ''' + swatch("#E2685F", "Danger", "failed, invalid", dark_text=True) + '''
          ''' + swatch("#4A443E", "Neutral", "\\u201cOther\\u201d in charts") + '''
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Radii &amp; controls</span>
        <div style="display: flex; align-items: flex-end; gap: 14px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 7px;"><div style="width: 58px; height: 58px; background: #171412; border: 1px solid #2A2521; border-radius: 22px;"></div><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #57504A;">22 card</span></div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 7px;"><div style="width: 58px; height: 58px; background: #171412; border: 1px solid #2A2521; border-radius: 14px;"></div><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #57504A;">14 button</span></div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 7px;"><div style="width: 58px; height: 58px; background: #171412; border: 1px solid #2A2521; border-radius: 12px;"></div><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #57504A;">12 input</span></div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 7px;"><div style="width: 58px; height: 58px; background: #171412; border: 1px solid #2A2521; border-radius: 999px;"></div><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #57504A;">999 pill</span></div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 7px;"><div style="width: 58px; height: 58px; background: #171412; border: 1px solid #2A2521; border-radius: 8px;"></div><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #57504A;">8 chip</span></div>
        </div>
      </div>
    </div>

    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px;">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Type</span>
        ''' + typerow("Bake a token", "Bricolage Grotesque 700 &#183; 34/1.1 &#183; -0.03em", "font-family: 'Bricolage Grotesque', system-ui; font-size: 34px; font-weight: 700; letter-spacing: -0.03em;") + '''
        ''' + typerow("5,140.46", "Bricolage 700 &#183; 38 &#183; tabular", "font-family: 'Bricolage Grotesque', system-ui; font-size: 38px; font-weight: 700; letter-spacing: -0.035em; font-variant-numeric: tabular-nums;") + '''
        ''' + typerow("Creates the mint and the initial supply.", "Instrument Sans 400 &#183; 14.5/1.5", "font-family: 'Instrument Sans', sans-serif; font-size: 14.5px; color: #A39B8F;") + '''
        ''' + typerow("INITIAL SUPPLY", "Instrument Sans 600 &#183; 12 &#183; 0.06em caps", "font-family: 'Instrument Sans', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6E665C;") + '''
        ''' + typerow("856TqPXn&#8230;Nd7eSdGt", "JetBrains Mono 400 &#183; 13", "font-family: 'JetBrains Mono', monospace; font-size: 13px;") + '''
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Buttons &#183; 52 / 44 / 40</span>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <span style="height: 44px; display: flex; align-items: center; padding: 0 22px; background: #E8A33D; border-radius: 14px; color: #1A1410; font-size: 14.5px; font-weight: 700;">Primary</span>
          <span style="height: 44px; display: flex; align-items: center; padding: 0 22px; background: #F2B457; border-radius: 14px; color: #1A1410; font-size: 14.5px; font-weight: 700;">Hover</span>
          <span style="height: 44px; display: flex; align-items: center; padding: 0 22px; background: #1E1A17; border: 1px solid #2A2521; border-radius: 14px; color: #F5F0E8; font-size: 14.5px; font-weight: 600;">Secondary</span>
          <span style="height: 44px; display: flex; align-items: center; padding: 0 22px; background: #221D19; border: 1px solid #2A2521; border-radius: 14px; color: #57504A; font-size: 14.5px; font-weight: 700;">Disabled</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Inputs</span>
        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;">
          <div style="height: 46px; display: flex; align-items: center; padding: 0 14px; background: #0F0D0B; border: 1px solid #2A2521; border-radius: 12px; font-size: 14px; color: #57504A;">Placeholder</div>
          <div style="height: 46px; display: flex; align-items: center; padding: 0 14px; background: #0F0D0B; border: 1px solid #E8A33D; border-radius: 12px; font-size: 14px; box-shadow: 0 0 0 3px rgba(232,163,61,0.15);">Focused</div>
          <div style="height: 46px; display: flex; align-items: center; padding: 0 14px; background: #0F0D0B; border: 1px solid #E2685F; border-radius: 12px; font-size: 14px; color: #E2685F;">Invalid</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #57504A;">Transaction states</span>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <span style="display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: #171412; border: 1px solid #241F1B; border-radius: 10px; font-size: 13px; color: #A39B8F;"><span style="width: 7px; height: 7px; border-radius: 999px; background: #6E665C;"></span>Awaiting signature</span>
          <span style="display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: #171412; border: 1px solid #241F1B; border-radius: 10px; font-size: 13px; color: #E8A33D;"><span style="width: 7px; height: 7px; border-radius: 999px; background: #E8A33D;"></span>Sent &#183; confirming</span>
          <span style="display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: #171412; border: 1px solid #241F1B; border-radius: 10px; font-size: 13px; color: #5FBF8C;"><span style="width: 7px; height: 7px; border-radius: 999px; background: #5FBF8C;"></span>Confirmed &#183; 1.8s</span>
          <span style="display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: #171412; border: 1px solid #241F1B; border-radius: 10px; font-size: 13px; color: #E2685F;"><span style="width: 7px; height: 7px; border-radius: 999px; background: #E2685F;"></span>Blockhash expired</span>
        </div>
      </div>
    </div>

  </div>
</div>
''' + FOOT

write("Foundations.dc.html", foundations.replace("\\u201c", "&#8220;").replace("\\u201d", "&#8221;"))
