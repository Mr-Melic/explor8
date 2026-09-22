/// Types for the purchase-enquiry inbox.
///
/// A signed-in visitor submits a purchase enquiry from the home page's
/// "Contact us to make a purchase" fold-out form, consenting to share the
/// information until they withdraw it. A submitter sees and withdraws only
/// their own enquiries; an administrator sees every non-withdrawn enquiry.
module {
  /// Canister timestamp in nanoseconds (never a client clock).
  public type Timestamp = Int;

  /// One purchase enquiry submitted by a signed-in visitor.
  public type Enquiry = {
    id : Text;
    /// The principal that submitted the enquiry.
    submittedBy : Principal;
    /// The submitter's name, as typed into the form.
    name : Text;
    /// The submitter's contact email, as typed into the form.
    email : Text;
    /// The submitter's telephone number, as typed into the form.
    phone : Text;
    /// The free-text message describing what the submitter wants to purchase.
    message : Text;
    /// Whether the submitter consented to share the information until withdrawn.
    consent : Bool;
    /// When the enquiry was submitted, from the canister clock.
    submittedAt : Timestamp;
    /// Whether the submitter has withdrawn permission to share the enquiry.
    withdrawn : Bool;
    /// When permission was withdrawn, or null while the enquiry stands.
    withdrawnAt : ?Timestamp;
  };

  /// An enquiry as returned to the frontend.
  public type EnquiryView = {
    id : Text;
    submittedBy : Principal;
    name : Text;
    email : Text;
    phone : Text;
    message : Text;
    consent : Bool;
    submittedAt : Timestamp;
    withdrawn : Bool;
    withdrawnAt : ?Timestamp;
  };

  /// Errors returned by enquiry mutations.
  public type EnquiryError = {
    #notAuthenticated;
    #notAuthorized;
    #unknownEnquiry : Text;
    #invalidInput : Text;
  };

  /// Input for submitting a purchase enquiry.
  public type NewEnquiryInput = {
    name : Text;
    email : Text;
    phone : Text;
    message : Text;
    consent : Bool;
  };
};
