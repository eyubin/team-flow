import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

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
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button type="button" size="small" color="error" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {message}
    </Alert>
  )
}
