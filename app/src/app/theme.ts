import type { ThemeConfig } from 'antd'

/** Корпоративные цвета BASF (руководство по дизайну, стр. 7). Основной акцент — тёмно-зелёный; остальные — для статусов. */
export const BRAND = {
  primary: '#00793A',
  lightGreen: '#65AC1E',
  darkBlue: '#004A96',
  lightBlue: '#21A0D2',
  orange: '#F39500',
  red: '#C50022',
  text: '#1E1E1E',
  bg: '#F3F4F4',
}

/** Тема: Helvetica/Arial, плоский стиль без теней, крупный текст, высокий контраст. */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorSuccess: BRAND.primary,
    colorInfo: BRAND.darkBlue,
    colorLink: BRAND.darkBlue,
    colorError: BRAND.red,
    colorWarning: BRAND.orange,
    colorInfoBg: '#E8EFF7',
    colorInfoBorder: '#B5CBE2',
    colorSuccessBg: '#E8F3EC',
    colorSuccessBorder: '#BBD9C7',
    colorWarningBg: '#FFF4DF',
    colorWarningBorder: '#F6D699',
    colorErrorBg: '#FBE9EC',
    colorErrorBorder: '#F0B8C0',
    colorBgLayout: BRAND.bg,
    colorTextBase: BRAND.text,
    fontSize: 15,
    controlHeight: 40,
    borderRadius: 2,
    boxShadow: 'none',
    boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.12)',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif",
  },
  components: {
    Button: { controlHeightLG: 48, fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Input: { controlHeightLG: 48 },
    Table: { headerBg: '#ECEEEE', cellPaddingBlock: 12 },
    Layout: { headerBg: '#FFFFFF', headerColor: BRAND.text, headerHeight: 64, headerPadding: '0 24px' },
    Menu: {
      horizontalItemSelectedColor: BRAND.primary,
      itemSelectedColor: BRAND.primary,
      horizontalItemHoverColor: BRAND.primary,
    },
    Switch: { trackHeight: 28, trackMinWidth: 52, handleSize: 22 },
    Checkbox: { controlInteractiveSize: 22 },
    Radio: { radioSize: 22, dotSize: 12 },
    Card: { boxShadowTertiary: 'none' },
  },
}
