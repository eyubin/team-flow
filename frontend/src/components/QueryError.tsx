import { Button, Callout, Flex } from '@radix-ui/themes'
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'

type QueryErrorProps = {
  message?: string
  onRetry?: () => void
}

/**
 * Generic "this request failed" banner, distinct from the 403 Forbidden
 * page. Pages previously only branched on isLoading vs. isForbidden, so a
 * network blip or 500 fell through and rendered the empty state (e.g. "No
 * workspaces yet") as if the account genuinely had nothing in it.
 */
export function QueryError({ message = "We couldn't load this. Please try again.", onRetry }: QueryErrorProps) {
  return (
    <Callout.Root color="red" role="alert">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Flex align="center" justify="between" gap="3" width="100%" wrap="wrap">
        <Callout.Text>{message}</Callout.Text>
        {onRetry && (
          <Button type="button" size="1" variant="soft" color="red" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Flex>
    </Callout.Root>
  )
}
