using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class BlockedPage : ContentPage
{
    private readonly BlockedPageViewModel _vm;

    public BlockedPage(BlockedPageViewModel vm)
    {
        InitializeComponent();

        _vm = vm;
        BindingContext = vm;

        vm.ClipboardWriter = text => Clipboard.Default.SetTextAsync(text);
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        // Fetched here rather than in the constructor so a slow or unreachable
        // server delays only the phone number, not the screen itself. The
        // student needs to read the block and their device id immediately.
        await _vm.LoadContactAsync();
    }
}
