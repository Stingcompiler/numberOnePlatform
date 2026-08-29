using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class LoginPage : ContentPage
{
    private readonly LoginViewModel _vm;

    public LoginPage(LoginViewModel vm)
    {
        InitializeComponent();

        _vm = vm;
        BindingContext = vm;

        // The view model stays free of MAUI types, so the platform clipboard is
        // handed to it rather than referenced from it.
        vm.ClipboardWriter = text => Clipboard.Default.SetTextAsync(text);
    }

}
