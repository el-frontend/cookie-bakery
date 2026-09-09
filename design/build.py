# Assembles the .dc.html artboards from shared chrome + per-screen bodies.
HEAD = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0F0D0B; color: #F5F0E8;
           font-family: "Instrument Sans", system-ui, sans-serif;
           -webkit-font-smoothing: antialiased; }
    a { color: #E8A33D; text-decoration: none; }
    a:hover { color: #F2B457; }
    ::placeholder { color: #57504A; }
  </style>
</helmet>
'''
FOOT = '''</x-dc>
</body>
</html>
'''

LOGO = '''<div style="display: flex; align-items: center; gap: 10px;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9.25" stroke="#E8A33D" stroke-width="1.5"/>
        <circle cx="9.2" cy="9.6" r="1.35" fill="#E8A33D"/>
        <circle cx="14.6" cy="12.4" r="1.1" fill="#E8A33D"/>
        <circle cx="10" cy="15.2" r="1" fill="#E8A33D"/>
      </svg>
      <span style="font-family: 'Bricolage Grotesque', system-ui; font-size: 17px; font-weight: 700; letter-spacing: -0.02em;">Cookie Bakery</span>
    </div>'''

def tabs(active):
    out = []
    for name in ("Bake", "Airdrop", "Oven"):
        if name == active:
            out.append('<span style="padding: 8px 18px; border-radius: 999px; background: #E8A33D; color: #1A1410; font-size: 13.5px; font-weight: 600;">%s</span>' % name)
        else:
            out.append('<span style="padding: 8px 18px; border-radius: 999px; color: #A39B8F; font-size: 13.5px; font-weight: 500;">%s</span>' % name)
    return ('<div style="display: flex; align-items: center; gap: 4px; padding: 4px; background: #171412; '
            'border: 1px solid #241F1B; border-radius: 999px;">' + "".join(out) + '</div>')

WALLET_ON = '''<div style="display: flex; align-items: center; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 7px; padding: 8px 12px; background: #171412; border: 1px solid #241F1B; border-radius: 10px;">
        <span style="width: 6px; height: 6px; border-radius: 999px; background: #5FBF8C; box-shadow: 0 0 0 3px rgba(95,191,140,0.16);"></span>
        <span style="font-size: 12.5px; color: #A39B8F; font-weight: 500;">Cookie Chain</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #6E665C;">1052ms</span>
      </div>
      <div style="display: flex; align-items: center; gap: 9px; padding: 7px 8px 7px 12px; background: #171412; border: 1px solid #241F1B; border-radius: 10px;">
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #F5F0E8;">6MGL&#8230;zRQa</span>
        <span style="padding: 4px 9px; background: #1E1A17; border-radius: 6px; font-size: 11.5px; font-weight: 600; color: #E8A33D; font-variant-numeric: tabular-nums;">5,140.46 COOK</span>
      </div>
    </div>'''

WALLET_OFF = '''<div style="display: flex; align-items: center; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 7px; padding: 8px 12px; background: #171412; border: 1px solid #241F1B; border-radius: 10px;">
        <span style="width: 6px; height: 6px; border-radius: 999px; background: #5FBF8C; box-shadow: 0 0 0 3px rgba(95,191,140,0.16);"></span>
        <span style="font-size: 12.5px; color: #A39B8F; font-weight: 500;">Cookie Chain</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; padding: 9px 16px; background: #E8A33D; border-radius: 10px; color: #1A1410; font-size: 13.5px; font-weight: 700;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M3 8.5A2.5 2.5 0 015.5 6H18a2 2 0 012 2v9a2 2 0 01-2 2H5.5A2.5 2.5 0 013 16.5v-8z" stroke="#1A1410" stroke-width="1.7"/>
          <path d="M16.5 12.5h.01" stroke="#1A1410" stroke-width="2.4" stroke-linecap="round"/>
        </svg>
        Connect wallet
      </div>
    </div>'''

def topbar(active, connected=True):
    return ('''<div style="display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 18px 32px; border-bottom: 1px solid #211D19;">
    ''' + LOGO + '''

    ''' + tabs(active) + '''

    ''' + (WALLET_ON if connected else WALLET_OFF) + '''
  </div>''')

def shell(body, active="Bake", connected=True, w=1280, h=880, glow=True):
    g = ('background-image: radial-gradient(900px 420px at 50% -8%, rgba(232,163,61,0.10), transparent 70%); '
         if glow else '')
    return (HEAD + '''
<div style="width: %dpx; height: %dpx; background: #0F0D0B; %sdisplay: flex; flex-direction: column;">

  %s

  %s
</div>
''' % (w, h, g, topbar(active, connected), body) + FOOT)

def write(name, content):
    with open(name, "w") as f:
        f.write(content)
    print("wrote", name)
