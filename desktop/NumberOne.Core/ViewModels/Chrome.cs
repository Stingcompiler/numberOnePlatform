namespace NumberOne.Core.ViewModels;

/// <summary>
/// A screen whose rows the top-bar search box filters.
///
/// The search field belongs to the chrome, not to any one screen, but only the
/// screen knows what a match means. A screen that does not implement this gets
/// no search box at all — a box that filters nothing is worse than no box.
/// </summary>
public interface ISearchable
{
    /// <summary>What the empty field prompts for, e.g. "ابحث في الكورسات".</summary>
    string SearchPlaceholder { get; }

    /// <summary>Applies the query. An empty string clears the filter.</summary>
    void ApplySearch(string query);
}

/// <summary>
/// Which dot the toast carries. Colour is the whole distinction: the text says
/// what happened, the dot says how it went.
/// </summary>
public enum ToastKind
{
    Success,
    Warning,
    Error,
}

/// <summary>
/// A transient message for an outcome with no screen of its own — a copied
/// device id, a session opening in the browser, a link the server never filled
/// in. Never used for anything the student must act on: those get a panel.
/// </summary>
public sealed record ToastMessage(string Text, ToastKind Kind = ToastKind.Success);
