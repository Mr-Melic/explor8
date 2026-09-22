/// Domain logic for the purchase-enquiry inbox.
import Map "mo:core/Map";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Types "../types/enquiry";
import RolesLib "roles";

module {
  /// The enquiry state shared with the API mixin.
  public type State = {
    var nextEnquirySeq : Nat;
    enquiries : Map.Map<Text, Types.Enquiry>;
  };

  /// The role state, needed to authorize the admin inbox.
  public type RolesState = RolesLib.State;

  /// Project an internal enquiry to its public view.
  func toView(enquiry : Types.Enquiry) : Types.EnquiryView {
    {
      id = enquiry.id;
      submittedBy = enquiry.submittedBy;
      name = enquiry.name;
      email = enquiry.email;
      phone = enquiry.phone;
      message = enquiry.message;
      consent = enquiry.consent;
      submittedAt = enquiry.submittedAt;
      withdrawn = enquiry.withdrawn;
      withdrawnAt = enquiry.withdrawnAt;
    };
  };

  /// Order two enquiries newest first, then by id.
  func compareEnquiries(a : Types.Enquiry, b : Types.Enquiry) : Order.Order {
    if (a.submittedAt > b.submittedAt) { return #less };
    if (a.submittedAt < b.submittedAt) { return #greater };
    if (a.id < b.id) { return #less };
    if (a.id > b.id) { return #greater };
    #equal;
  };

  /// Trim leading and trailing spaces from a text field.
  func trimmed(value : Text) : Text {
    value.trim(#predicate (func (c : Char) : Bool = c == ' '));
  };

  /// Submit a purchase enquiry. Signed-in callers only, and consent is
  /// required: an enquiry without consent is rejected.
  public func submitEnquiry(
    state : State,
    caller : Principal,
    input : Types.NewEnquiryInput,
  ) : Result.Result<Types.EnquiryView, Types.EnquiryError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not input.consent) {
      return #err(#invalidInput("consent is required to submit an enquiry"));
    };
    let name = trimmed(input.name);
    if (name == "") {
      return #err(#invalidInput("an enquiry needs a name"));
    };
    let email = trimmed(input.email);
    if (email == "") {
      return #err(#invalidInput("an enquiry needs an email address"));
    };
    let message = trimmed(input.message);
    if (message == "") {
      return #err(#invalidInput("an enquiry needs a message"));
    };
    state.nextEnquirySeq += 1;
    let id = "enq-" # state.nextEnquirySeq.toText();
    let enquiry : Types.Enquiry = {
      id;
      submittedBy = caller;
      name;
      email;
      phone = trimmed(input.phone);
      message;
      consent = true;
      submittedAt = Time.now();
      withdrawn = false;
      withdrawnAt = null;
    };
    state.enquiries.add(id, enquiry);
    #ok(toView(enquiry));
  };

  /// List the caller's own enquiries, newest first. Signed-in callers only.
  public func listMyEnquiries(
    state : State,
    caller : Principal,
  ) : Result.Result<[Types.EnquiryView], Types.EnquiryError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    let mine = state.enquiries.values().filter(
      func (enquiry : Types.Enquiry) : Bool = enquiry.submittedBy.equal(caller)
    );
    let sorted = mine.toArray().sort(compareEnquiries);
    #ok(sorted.map(func (enquiry : Types.Enquiry) : Types.EnquiryView = toView(enquiry)));
  };

  /// Withdraw the caller's own enquiry. Signed-in callers only; an enquiry
  /// that belongs to another principal is rejected.
  public func withdrawEnquiry(
    state : State,
    caller : Principal,
    id : Text,
  ) : Result.Result<Types.EnquiryView, Types.EnquiryError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    let existing = switch (state.enquiries.get(id)) {
      case (?enquiry) enquiry;
      case null { return #err(#unknownEnquiry(id)) };
    };
    if (not existing.submittedBy.equal(caller)) {
      return #err(#unknownEnquiry(id));
    };
    if (existing.withdrawn) {
      return #ok(toView(existing));
    };
    let updated : Types.Enquiry = {
      existing with
      withdrawn = true;
      withdrawnAt = ?Time.now();
    };
    state.enquiries.add(id, updated);
    #ok(toView(updated));
  };

  /// List every non-withdrawn enquiry, newest first. Admin only.
  public func listEnquiries(
    state : State,
    roles : RolesState,
    caller : Principal,
  ) : Result.Result<[Types.EnquiryView], Types.EnquiryError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    let open = state.enquiries.values().filter(
      func (enquiry : Types.Enquiry) : Bool = not enquiry.withdrawn
    );
    let sorted = open.toArray().sort(compareEnquiries);
    #ok(sorted.map(func (enquiry : Types.Enquiry) : Types.EnquiryView = toView(enquiry)));
  };
};
