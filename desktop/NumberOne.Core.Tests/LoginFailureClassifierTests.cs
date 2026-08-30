using NumberOne.Core.Api;

namespace NumberOne.Core.Tests;

/// <summary>
/// The server distinguishes its four login refusals only by Arabic message
/// text - LoginSerializer sets code="device_mismatch" but DRF drops codes
/// before rendering. These tests pin the exact literals from
/// accounts/models.py and accounts/serializers.py, so a server-side rewording
/// fails here rather than silently degrading two screens to a generic error.
/// </summary>
public class LoginFailureClassifierTests
{
    [Fact]
    public void Account_bound_to_another_device_is_recognised()
    {
        Assert.Equal(
            LoginFailureReason.AccountBoundElsewhere,
            LoginFailureClassifier.Classify(ServerMessages.AccountBoundElsewhere));
    }

    [Fact]
    public void Device_held_by_another_student_is_recognised()
    {
        Assert.Equal(
            LoginFailureReason.DeviceBoundToAnotherStudent,
            LoginFailureClassifier.Classify(ServerMessages.DeviceBoundToAnotherStudent));
    }

    [Fact]
    public void The_two_device_refusals_do_not_collide()
    {
        // Both open with the same words and diverge only at the noun. Confusing
        // them would send a student on a shared lab PC to a screen telling them
        // their own account is on another device.
        var a = LoginFailureClassifier.Classify(ServerMessages.AccountBoundElsewhere);
        var b = LoginFailureClassifier.Classify(ServerMessages.DeviceBoundToAnotherStudent);

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Bad_credentials_is_recognised()
    {
        Assert.Equal(
            LoginFailureReason.BadCredentials,
            LoginFailureClassifier.Classify(ServerMessages.BadCredentials));
    }

    [Fact]
    public void Suspended_account_is_recognised()
    {
        Assert.Equal(
            LoginFailureReason.AccountSuspended,
            LoginFailureClassifier.Classify(ServerMessages.AccountSuspended));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("something the server has not said before")]
    public void Anything_unrecognised_falls_through_to_Unknown(string? message)
    {
        Assert.Equal(LoginFailureReason.Unknown, LoginFailureClassifier.Classify(message));
    }
}

/// <summary>
/// The login refusals arrive as non_field_errors, not detail - a parser that
/// only reads "detail" shows a blank error on the one screen where the message
/// carries all the meaning.
/// </summary>
public class DrfErrorTests
{
    [Fact]
    public void Reads_non_field_errors_which_is_the_shape_login_refusals_use()
    {
        var body = """{"non_field_errors":["هذا الحساب مرتبط بجهاز آخر. يرجى التواصل مع الإدارة لفك الارتباط."]}""";

        Assert.Equal(ServerMessages.AccountBoundElsewhere, DrfError.ExtractMessage(body));
    }

    [Fact]
    public void Reads_detail_which_is_the_shape_view_level_errors_use()
    {
        var body = """{"detail":"ليس لديك صلاحية الوصول لهذا الكورس."}""";

        Assert.Equal("ليس لديك صلاحية الوصول لهذا الكورس.", DrfError.ExtractMessage(body));
    }

    [Fact]
    public void Prefers_non_field_errors_when_both_are_present()
    {
        var body = """{"detail":"generic","non_field_errors":["specific"]}""";

        Assert.Equal("specific", DrfError.ExtractMessage(body));
    }

    [Fact]
    public void Falls_back_to_a_field_error()
    {
        var body = """{"username":["This field is required."]}""";

        Assert.Equal("This field is required.", DrfError.ExtractMessage(body));
    }

    [Theory]
    [InlineData("")]
    [InlineData("<html><body>502 Bad Gateway</body></html>")]
    [InlineData("{}")]
    public void Returns_null_rather_than_throwing_on_bodies_that_carry_no_message(string body)
    {
        Assert.Null(DrfError.ExtractMessage(body));
    }
}
