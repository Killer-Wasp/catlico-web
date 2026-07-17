import {
  casesQueryOptions,
  createCaseObservable,
  createCaseObservableFile,
} from '#/components/Cases/casesQueries'
import type { CaseListFilters } from '#/components/Cases/casesQueries'
import {
  createAlertObservable,
  createAlertObservableFile,
} from '#/components/Alerts/alertsQueries'
import { observableTypesQueryOptions } from '#/components/pages/settings/settingsQueries'
import { FormDrawer } from '#/components/ui/FormDrawer'
import { TLP } from '#/lib/domain'
import type { Tlp } from '#/lib/domain'
import {
  Alert,
  Button,
  Checkbox,
  Combobox,
  FileButton,
  Group,
  Input,
  InputBase,
  Select,
  Stack,
  Text,
  TextInput,
  useCombobox,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useMutation, useQuery } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { useMemo, useState } from 'react'

export type CreateObservableDialogProps = {
  /** Whether the dialog is visible. */
  opened: boolean
  /** Called when the dialog should close (cancel or after a successful create). */
  onClose: () => void
  /**
   * When provided, the target case is fixed (case-detail usage) and no case
   * picker is shown. When omitted (org-wide usage), a searchable case picker is
   * rendered and the chosen case supplies the create target.
   */
  caseId?: number
  /**
   * When provided, the observable is created on this alert (alert-drawer usage,
   * §4.1c) via the alert observable routes. Mutually exclusive with `caseId`;
   * like a fixed `caseId`, it suppresses the case picker.
   */
  alertId?: string
  /** Called after a successful create so the caller can invalidate its lists. */
  onCreated?: () => void
}

/**
 * Shared create-observable dialog used both on the case-detail Observables tab
 * (with a fixed `caseId`) and on the org-wide Observables page (with a case
 * picker). A single Type selector spans every observable type: string types
 * render a value field and submit JSON, attachment types render a file field
 * and submit multipart.
 */
export function CreateObservableDialog({
  opened,
  onClose,
  caseId,
  alertId,
  onCreated,
}: CreateObservableDialogProps) {
  const [newType, setNewType] = useState<string | null>(null)
  const [newData, setNewData] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [newTlp, setNewTlp] = useState('2')
  const [newIoc, setNewIoc] = useState(false)
  const [newSighted, setNewSighted] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [caseSearch, setCaseSearch] = useState('')
  const [selectedCase, setSelectedCase] = useState<{
    id: string
    title: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // An alert target fixes the entity like a fixed case id — no picker either way.
  const needsCasePicker = caseId == null && alertId == null

  const caseCombobox = useCombobox({
    onDropdownClose: () => caseCombobox.resetSelectedOption(),
    onDropdownOpen: () => caseCombobox.focusSearchInput(),
  })

  const { data: obsTypes } = useQuery({
    ...observableTypesQueryOptions(),
    enabled: opened,
  })
  const typeOptions = (obsTypes ?? []).map((t) => ({
    value: t.name,
    label: t.name,
  }))
  const selectedTypeMeta = (obsTypes ?? []).find((t) => t.name === newType)
  const isFileMode = selectedTypeMeta?.is_attachment ?? false

  // Debounce so typing doesn't refetch (and mint a new cache entry) per
  // keystroke — the repo convention (see Search/SearchPalette, Table/AssignMenu).
  const [debouncedSearch] = useDebouncedValue(caseSearch, 200)
  const caseSearchFilters = useMemo<CaseListFilters>(() => {
    const search = debouncedSearch.trim()
    return {
      skip: 0,
      limit: 10,
      ...(search
        ? { clauses: [{ key: 'title', op: 'co', value: search }] }
        : {}),
    }
  }, [debouncedSearch])
  const { data: caseResults } = useQuery({
    ...casesQueryOptions(caseSearchFilters),
    enabled: opened && needsCasePicker,
  })

  const targetCaseId = needsCasePicker
    ? (selectedCase?.id ?? null)
    : caseId != null
      ? String(caseId)
      : null
  // For an alert target, whether we have a place to create the observable.
  const hasTarget = alertId != null ? true : Boolean(targetCaseId)

  const reset = () => {
    setNewType(null)
    setNewData('')
    setNewMessage('')
    setNewTlp('2')
    setNewIoc(false)
    setNewSighted(false)
    setFile(null)
    setCaseSearch('')
    setSelectedCase(null)
    setErrorMessage(null)
  }

  const handleSuccess = () => {
    onCreated?.()
    reset()
    onClose()
  }
  const handleError = (error: unknown) => {
    if (isHTTPError(error) && error.response.status === 409) {
      setErrorMessage(
        `An observable with this type and value already exists on the ${
          alertId != null ? 'alert' : 'case'
        }.`,
      )
    } else {
      setErrorMessage('Could not create the observable. Please try again.')
    }
  }

  const addObservable = useMutation({
    mutationFn: () => {
      const body = {
        observable_type: newType!,
        data: newData,
        message: newMessage,
        tlp: Number(newTlp),
        ioc: newIoc,
        sighted: newSighted,
      }
      return alertId != null
        ? createAlertObservable(alertId, body)
        : createCaseObservable(targetCaseId!, body)
    },
    onSuccess: handleSuccess,
    onError: handleError,
  })
  const addObservableFile = useMutation({
    mutationFn: () => {
      const body = {
        observable_type: newType!,
        file: file!,
        message: newMessage,
        tlp: Number(newTlp),
        ioc: newIoc,
        sighted: newSighted,
      }
      return alertId != null
        ? createAlertObservableFile(alertId, body)
        : createCaseObservableFile(targetCaseId!, body)
    },
    onSuccess: handleSuccess,
    onError: handleError,
  })

  const isPending = addObservable.isPending || addObservableFile.isPending
  const canSubmit =
    hasTarget &&
    Boolean(newType) &&
    (isFileMode ? Boolean(file) : Boolean(newData.trim()))

  const submit = () => {
    setErrorMessage(null)
    if (isFileMode) addObservableFile.mutate()
    else addObservable.mutate()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <FormDrawer
      opened={opened}
      onClose={handleClose}
      title="Add observable"
      submitLabel="Add observable"
      submitDisabled={!canSubmit}
      loading={isPending}
      onSubmit={submit}
    >
      <Stack gap="md">
        {needsCasePicker ? (
          <Combobox
            store={caseCombobox}
            withinPortal={false}
            onOptionSubmit={(val) => {
              const picked = (caseResults?.cases ?? []).find(
                (c) => c.id === val,
              )
              if (picked)
                setSelectedCase({ id: picked.id, title: picked.title })
              caseCombobox.closeDropdown()
            }}
          >
            <Combobox.Target>
              <InputBase
                label="Case"
                component="button"
                type="button"
                pointer
                rightSection={<Combobox.Chevron />}
                rightSectionPointerEvents="none"
                onClick={() => caseCombobox.toggleDropdown()}
              >
                {selectedCase ? (
                  <Text component="span" truncate>
                    {selectedCase.title} ({selectedCase.id})
                  </Text>
                ) : (
                  <Input.Placeholder>Search cases by title</Input.Placeholder>
                )}
              </InputBase>
            </Combobox.Target>

            <Combobox.Dropdown>
              <Combobox.Search
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.currentTarget.value)}
                placeholder="Search cases by title"
              />
              <Combobox.Options mah={280} style={{ overflowY: 'auto' }}>
                {(caseResults?.cases ?? []).map((caseItem) => (
                  <Combobox.Option value={caseItem.id} key={caseItem.id}>
                    <Text truncate>{caseItem.title}</Text>
                    <Text c="dimmed" fz="xs">
                      {caseItem.id}
                    </Text>
                  </Combobox.Option>
                ))}
                {(caseResults?.cases ?? []).length === 0 ? (
                  <Combobox.Empty>No cases found.</Combobox.Empty>
                ) : null}
              </Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>
        ) : null}

        <Select
          label="Type"
          data={typeOptions}
          value={newType}
          onChange={setNewType}
          required
        />

        {isFileMode ? (
          <Input.Wrapper label="File">
            <Group gap="sm">
              <FileButton onChange={setFile}>
                {(props) => (
                  <Button variant="default" {...props}>
                    Choose file
                  </Button>
                )}
              </FileButton>
              <Text fz="sm" c={file ? undefined : 'dimmed'} truncate>
                {file ? file.name : 'No file chosen'}
              </Text>
            </Group>
          </Input.Wrapper>
        ) : (
          <TextInput
            label="Value"
            value={newData}
            onChange={(e) => setNewData(e.currentTarget.value)}
            required
          />
        )}

        <TextInput
          label="Message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.currentTarget.value)}
        />
        <Select
          label="TLP"
          data={[0, 1, 2, 3].map((n) => ({
            value: String(n),
            label: `${n} — ${TLP[n as Tlp]}`,
          }))}
          value={newTlp}
          onChange={(v) => setNewTlp(v ?? '2')}
        />
        <Checkbox
          label="IOC (indicator of compromise)"
          checked={newIoc}
          onChange={(e) => setNewIoc(e.currentTarget.checked)}
        />
        <Checkbox
          label="Sighted"
          checked={newSighted}
          onChange={(e) => setNewSighted(e.currentTarget.checked)}
        />

        {errorMessage ? (
          <Alert color="red" variant="light">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    </FormDrawer>
  )
}
