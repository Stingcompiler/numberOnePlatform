using Microsoft.UI.Xaml;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace NumberOne.Desktop.WinUI;

/// <summary>
/// Provides application-specific behavior to supplement the default Application class.
/// </summary>
public partial class App : MauiWinUIApplication
{
	/// <summary>
	/// Initializes the singleton application object.  This is the first line of authored code
	/// executed, and as such is the logical equivalent of main() or WinMain().
	/// </summary>
	public App()
	{
		this.InitializeComponent();

		// The one that actually fires for a fault on the UI thread.
		//
		// AppDomain.UnhandledException does not see these: WinUI raises its own
		// event first, which is what the generated App.g.i.cs hook attaches to
		// in a debug build — it breaks in the debugger and, with no debugger
		// attached, the window simply closes. On a school machine that leaves
		// nothing behind but "it broke".
		//
		// The exception is written to the crash log AND shown on screen, and
		// the fault is marked handled.
		//
		// Marking it handled is a deliberate reversal. The app was already
		// dying at this point, so "do not continue in a state nobody has
		// reasoned about" was choosing between a window that vanishes with no
		// message and one that stays with a message naming the fault. The
		// second is better for a student — they can read it back, and close the
		// app themselves — and it is the only version that ever produced a
		// usable report.
		this.UnhandledException += (_, e) =>
		{
			NumberOne.Desktop.App.RecordUnhandled("WinUI", e.Exception);
			NumberOne.Desktop.App.ShowFault(e.Exception);

			e.Handled = true;
		};
	}

	protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}

