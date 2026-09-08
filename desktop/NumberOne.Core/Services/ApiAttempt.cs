namespace NumberOne.Core.Services;

/// <summary>
/// The outcome of one API call that the caller has to handle itself.
///
/// Reads on this client go through SectionState, which catches transport
/// failures and turns them into a retryable panel. WRITES had no equivalent:
/// marking a lecture complete, submitting an exercise, marking a notification
/// read and submitting an exam all called the API bare, so a dropped connection
/// threw straight out of a command.
///
/// In the worst case that was fatal rather than untidy. The exam runner's
/// countdown submits automatically from a timer whose handler is `async void`,
/// and an exception out of `async void` has nowhere to go — it takes the
/// process with it, at the exact moment a student's time expires and their
/// answers are still unsent.
///
/// This gives those paths the same treatment reads already had, in one place so
/// the catch filter cannot drift between them.
/// </summary>
public readonly record struct ApiAttempt<T>(bool Ok, T? Value, string? Error)
{
    public static ApiAttempt<T> Success(T value) => new(true, value, null);
    public static ApiAttempt<T> Failure(string error) => new(false, default, error);
}

public static class ApiAttempt
{
    /// <summary>
    /// Runs a call and reports what happened instead of throwing.
    ///
    /// A cancellation the CALLER asked for is not a failure — the screen went
    /// away — so it reports failure with no message, and the caller shows
    /// nothing. Everything else carries text the student can act on: the
    /// server's own words where it sent any, and "no connection" otherwise.
    /// </summary>
    public static async Task<ApiAttempt<T>> TryAsync<T>(
        Func<CancellationToken, Task<T>> work, CancellationToken ct = default)
    {
        try
        {
            return ApiAttempt<T>.Success(await work(ct).ConfigureAwait(true));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            return ApiAttempt<T>.Failure("");
        }
        catch (ApiRequestException ex)
        {
            return ApiAttempt<T>.Failure(ex.Message);
        }
        catch (Exception ex) when (IsTransport(ex))
        {
            return ApiAttempt<T>.Failure(DesktopMessages.NoConnection);
        }
    }

    /// <summary>
    /// A transport failure rather than a bug.
    ///
    /// IOException is in the list on purpose: an aborted socket surfaces as
    /// TaskCanceledException wrapping IOException wrapping SocketException, and
    /// only the outermost type is matched by a plain `is` check. A request
    /// killed by the app closing arrives exactly that way.
    /// </summary>
    public static bool IsTransport(Exception ex) =>
        ex is HttpRequestException
           or OperationCanceledException
           or System.IO.IOException
           or System.Net.Sockets.SocketException;
}
