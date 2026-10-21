import { useState } from 'react'
import { Alert, App, Button, Checkbox, Drawer, Form, Input, Radio, Space, Typography } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { CLIENT_PERMISSIONS, PERMISSION_GROUPS } from '@/shared/lib/permissionsMeta'
import type { Permission, RoleType } from '@/shared/types/domain'
import { useSaveRoleMutation, type RoleRow } from './rolesApi'

const t = ru.roles.drawer
const ALL = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key))

export interface RoleDraft {
  name: string
  type: RoleType
  description: string
  permissions: Permission[]
  active: boolean
}

/** Конструктор роли: название, тип и набор разрешений по группам. */
export function RoleDrawer({
  role,
  draft,
  open,
  onClose,
}: {
  role: RoleRow | null
  draft?: RoleDraft
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [save, { isLoading }] = useSaveRoleMutation()
  const initial: RoleDraft = draft ?? {
    name: role?.name ?? '',
    type: role?.type ?? 'employee',
    description: role?.description ?? '',
    permissions: role?.permissions ?? [],
    active: role?.active ?? true,
  }
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [type, setType] = useState<RoleType>(initial.type)
  const [perms, setPerms] = useState<Permission[]>(initial.permissions)
  const system = role?.fullAccess === true
  const typeLocked = !!role && role.usersCount > 0
  const allowed = type === 'client' ? CLIENT_PERMISSIONS : ALL

  const toggle = (p: Permission, on: boolean) =>
    setPerms((cur) => (on ? [...new Set([...cur, p])] : cur.filter((x) => x !== p)))
  const changeType = (next: RoleType) => {
    setType(next)
    if (next === 'client') setPerms((cur) => cur.filter((p) => CLIENT_PERMISSIONS.includes(p)))
  }

  const submit = async () => {
    const r = await save({
      id: role?.id,
      name,
      type,
      description,
      permissions: perms.filter((p) => allowed.includes(p)),
      active: initial.active,
    })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.saved)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      width={Math.min(640, window.innerWidth)}
      title={role ? `${t.titleEdit}: ${role.name}` : t.titleNew}
      footer={
        <div className="card-actions">
          <Button type="primary" size="large" disabled={system || !name.trim()} loading={isLoading} onClick={submit}>
            {ru.common.save}
          </Button>
          <Button size="large" onClick={onClose}>
            {ru.common.cancel}
          </Button>
        </div>
      }
    >
      {system && <Alert type="info" showIcon message={t.systemNote} style={{ marginBottom: 16 }} />}
      {role && role.usersCount > 0 && !system && (
        <Alert type="warning" showIcon message={t.affects(role.usersCount)} style={{ marginBottom: 16 }} />
      )}
      <Form layout="vertical" size="large" requiredMark={false} disabled={system}>
        <Form.Item label={t.name} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Form.Item>
        <Form.Item label={t.description}>
          <Input.TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Form.Item>
        <Form.Item label={t.type} extra={typeLocked ? t.typeLocked : undefined}>
          <Radio.Group value={type} onChange={(e) => changeType(e.target.value)} disabled={typeLocked || system}>
            <Radio value="employee">{ru.roles.type.employee}</Radio>
            <Radio value="client">{ru.roles.type.client}</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>

      <div className="tab-head" style={{ marginBottom: 8 }}>
        <strong>{t.permissions}</strong>
        <Space>
          <Typography.Text type="secondary">
            {t.selected(perms.filter((p) => allowed.includes(p)).length, allowed.length)}
          </Typography.Text>
          <Button type="link" disabled={system} onClick={() => setPerms([...allowed])}>
            {t.selectAll}
          </Button>
          <Button type="link" disabled={system} onClick={() => setPerms([])}>
            {t.clear}
          </Button>
        </Space>
      </div>
      {type === 'client' && <Alert type="info" showIcon message={t.clientNote} style={{ marginBottom: 12 }} />}
      {PERMISSION_GROUPS.map((g) => {
        const items = g.items.filter((i) => allowed.includes(i.key))
        if (!items.length) return null
        return (
          <div key={g.title} className="perm-group">
            <h4>{g.title}</h4>
            {items.map((i) => (
              <label key={i.key} className="perm-row">
                <Checkbox
                  disabled={system}
                  checked={system || perms.includes(i.key)}
                  onChange={(e) => toggle(i.key, e.target.checked)}
                />
                <span>
                  <strong>{i.label}</strong>
                  <small>{i.hint}</small>
                </span>
              </label>
            ))}
          </div>
        )
      })}
    </Drawer>
  )
}
