/// Public API for the purchase-enquiry inbox.
import Result "mo:core/Result";
import Types "../types/enquiry";
import EnquiryLib "../lib/enquiry";
import RolesLib "../lib/roles";

mixin (
  enquiryState : EnquiryLib.State,
  rolesState : RolesLib.State,
) {
  /// Submit a purchase enquiry. Signed-in callers only; consent is required.
  public shared ({ caller }) func submitEnquiry(input : Types.NewEnquiryInput) : async Result.Result<Types.EnquiryView, Types.EnquiryError> {
    EnquiryLib.submitEnquiry(enquiryState, caller, input);
  };

  /// List the caller's own enquiries, newest first. Signed-in callers only.
  public query ({ caller }) func listMyEnquiries() : async Result.Result<[Types.EnquiryView], Types.EnquiryError> {
    EnquiryLib.listMyEnquiries(enquiryState, caller);
  };

  /// Withdraw the caller's own enquiry. Signed-in callers only.
  public shared ({ caller }) func withdrawEnquiry(id : Text) : async Result.Result<Types.EnquiryView, Types.EnquiryError> {
    EnquiryLib.withdrawEnquiry(enquiryState, caller, id);
  };

  /// List every non-withdrawn enquiry, newest first. Admin only.
  public query ({ caller }) func listEnquiries() : async Result.Result<[Types.EnquiryView], Types.EnquiryError> {
    EnquiryLib.listEnquiries(enquiryState, rolesState, caller);
  };
};
