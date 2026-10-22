# -*- coding: utf-8 -*-
"""SlideDSL helper components matching the 主线 v2 template."""

BLUE = "#073E87"
RED = "#9D0A12"
GOLD = "#C9A227"
ORANGE = "#F59E0B"
INK = "#1F2937"
MUTED = "#6B7280"
FAINT = "#9CA3AF"
LINE = "#E5E7EB"
CARD = "#F5F7FB"

def b(txt: str, color: str | None = None) -> str:
    c = f", color: '{color}'" if color else ""
    return f"<span style={{{{ fontWeight: 'bold'{c} }}}}>{txt}</span>"

def hdr(badge: str, title: str, sub: str) -> str:
    return f"""    <AutoLayout direction="vertical" width="fill" gap={{4}}>
      <AutoLayout direction="horizontal" width="fill" gap={{10}} verticalAlignItems="center">
        <AutoLayout width={{6}} height={{26}} style={{{{ background: '{RED}', borderRadius: '2px' }}}} />
        <AutoLayout padding="2px 10px" style={{{{ background: 'rgba(7,62,135,0.10)', borderRadius: '3px' }}}}>
          <Text style={{{{ fontSize: '15px', color: '{BLUE}', fontWeight: 'bold' }}}}>{badge}</Text>
        </AutoLayout>
        <Text width="fill" style={{{{ fontSize: '28px', color: '{BLUE}', fontWeight: 'bold', lineHeight: '34px' }}}}>{title}</Text>
      </AutoLayout>
      <Text width="fill" style={{{{ fontSize: '16px', color: '{MUTED}', lineHeight: '22px' }}}}>{sub}</Text>
      <AutoLayout width="fill" height={{2}} style={{{{ background: 'linear-gradient(90deg, {BLUE} 0%, rgba(7,62,135,0.22) 60%, rgba(7,62,135,0) 100%)' }}}} />
    </AutoLayout>"""

def duo(l1: str, t1: str, l2: str, t2: str) -> str:
    return f"""    <AutoLayout direction="horizontal" width="fill" height={{48}} gap={{14}} padding="7px 14px" verticalAlignItems="center" style={{{{ background: 'rgba(7,62,135,0.06)', border: '1px solid rgba(7,62,135,0.20)', borderRadius: '6px' }}}}>
      <AutoLayout direction="horizontal" width={{556}} gap={{8}} verticalAlignItems="center">
        <AutoLayout padding="2px 8px" style={{{{ background: '{BLUE}', borderRadius: '3px' }}}}>
          <Text style={{{{ fontSize: '13px', color: '#FFFFFF', fontWeight: 'bold' }}}}>{l1}</Text>
        </AutoLayout>
        <Text width="fill" style={{{{ fontSize: '14px', color: '{INK}', lineHeight: '19px' }}}}>{t1}</Text>
      </AutoLayout>
      <AutoLayout width={{1}} height={{28}} style={{{{ background: 'rgba(7,62,135,0.22)' }}}} />
      <AutoLayout direction="horizontal" width={{556}} gap={{8}} verticalAlignItems="center">
        <AutoLayout padding="2px 8px" style={{{{ background: '{RED}', borderRadius: '3px' }}}}>
          <Text style={{{{ fontSize: '13px', color: '#FFFFFF', fontWeight: 'bold' }}}}>{l2}</Text>
        </AutoLayout>
        <Text width="fill" style={{{{ fontSize: '14px', color: '{INK}', lineHeight: '19px' }}}}>{t2}</Text>
      </AutoLayout>
    </AutoLayout>"""

def left_card(tag_txt: str, tag_bg: str, title: str, lines: list[str], height: int) -> str:
    items = "\n".join(
        f'          <Text width="fill" style={{{{ fontSize: \'14px\', color: \'{INK}\', lineHeight: \'19px\' }}}}>· {ln}</Text>'
        for ln in lines
    )
    return f"""        <AutoLayout direction="vertical" width="fill" height={{{height}}} padding="8px 12px" gap={{4}} style={{{{ background: '{CARD}', border: '1px solid {LINE}', borderLeft: '4px solid {tag_bg}', borderRadius: '6px' }}}}>
          <AutoLayout direction="horizontal" width="fill" gap={{8}} verticalAlignItems="center">
            <AutoLayout padding="1px 7px" style={{{{ background: '{tag_bg}', borderRadius: '3px' }}}}>
              <Text style={{{{ fontSize: '12px', color: '#FFFFFF', fontWeight: 'bold' }}}}>{tag_txt}</Text>
            </AutoLayout>
            <Text width="fill" style={{{{ fontSize: '16px', color: '{BLUE}', fontWeight: 'bold', lineHeight: '20px' }}}}>{title}</Text>
          </AutoLayout>
{items}
        </AutoLayout>"""

def top_strip_card(tag_txt: str, tag_bg: str, title: str, desc: str, width: int) -> str:
    return f"""        <AutoLayout direction="vertical" width={{{width}}} height={{50}} padding="5px 10px" gap={{2}} style={{{{ background: '{CARD}', border: '1px solid {LINE}', borderTop: '3px solid {tag_bg}', borderRadius: '5px' }}}}>
          <AutoLayout direction="horizontal" width="fill" gap={{6}} verticalAlignItems="center">
            <AutoLayout padding="1px 6px" style={{{{ background: '{tag_bg}', borderRadius: '3px' }}}}>
              <Text style={{{{ fontSize: '11px', color: '#FFFFFF', fontWeight: 'bold' }}}}>{tag_txt}</Text>
            </AutoLayout>
            <Text width="fill" style={{{{ fontSize: '14px', color: '{BLUE}', fontWeight: 'bold', lineHeight: '18px' }}}}>{title}</Text>
          </AutoLayout>
          <Text width="fill" style={{{{ fontSize: '12.5px', color: '{INK}', lineHeight: '16px' }}}}>{desc}</Text>
        </AutoLayout>"""
