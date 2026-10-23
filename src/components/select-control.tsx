'use client';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useRef,
  useLayoutEffect,
  useCallback,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import {
  Select,
  Button,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
  Label,
} from 'react-aria-components';
import { Check, ChevronDown } from 'lucide-react';

export const ControlLabelContext = createContext<string | undefined>(undefined);
type Props = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'multiple' | 'size' | 'value' | 'defaultValue'
> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  onAction?: (value: string) => void;
};
type Option = { id: string; label: string; disabled: boolean };
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)
    )
      return [];
    if (child.type !== 'option') return optionsFrom(child.props.children);
    const label = Children.toArray(child.props.children).join('');
    return [
      { id: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) },
    ];
  });
}

/** One accessible listbox for both controlled filters and native FormData forms. */
export function SelectControl({
  children,
  value,
  defaultValue,
  onChange,
  onAction,
  id,
  name,
  required,
  disabled,
  className = '',
  ...props
}: Props) {
  const fieldLabel = useContext(ControlLabelContext);
  const options = optionsFrom(children);
  const labelId = useId();
  const label = props['aria-label'] ?? fieldLabel ?? 'Elegir opción';
  const pendingAction = useRef<string | null>(null);
  const action = useRef(onAction);
  useLayoutEffect(() => {
    action.current = onAction;
  }, [onAction]);
  const popoverRef = useCallback((node: HTMLDivElement | null) => {
    if (!node && pendingAction.current !== null) {
      const selected = pendingAction.current;
      pendingAction.current = null;
      // Run insertion after the closing animation and focus restoration, including reduced motion.
      requestAnimationFrame(() => action.current?.(selected));
    }
  }, []);
  return (
    <Select
      className="brand-select"
      name={name}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      isRequired={required}
      isDisabled={disabled}
      selectedKey={value === undefined ? undefined : String(value)}
      defaultSelectedKey={String(defaultValue ?? options[0]?.id ?? '')}
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.id)}
      onSelectionChange={(key) => {
        const selected = String(key ?? '');
        if (onAction) pendingAction.current = selected;
        else onChange?.({ target: { value: selected } });
      }}
    >
      <Label id={labelId} className="sr-only">
        {label}
      </Label>
      <Button id={id} aria-labelledby={labelId} className={`brand-select-trigger ${className}`}>
        <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
        <ChevronDown size={17} aria-hidden="true" />
      </Button>
      <Popover
        ref={popoverRef}
        className="brand-select-popover"
        placement="bottom start"
        offset={6}
      >
        <ListBox className="brand-select-list" items={options}>
          {(option) => (
            <ListBoxItem
              id={option.id}
              textValue={option.label}
              className="brand-select-option"
              data-value={option.id}
            >
              {({ isSelected }) => (
                <>
                  <span>{option.label}</span>
                  <Check size={17} aria-hidden="true" style={{ opacity: isSelected ? 1 : 0 }} />
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}
