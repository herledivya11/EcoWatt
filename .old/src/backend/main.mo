import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Float "mo:core/Float";

actor {
  type PredictionHistory = {
    householdType : Text;
    applianceCount : Nat;
    dailyUsage : Float;
    predictedUnits : Float;
    billTotal : Float;
    co2Emissions : Float;
    timestamp : Time.Time;
  };

  module PredictionHistory {
    public func compare(history1 : PredictionHistory, history2 : PredictionHistory) : Order.Order {
      if (history1.timestamp < history2.timestamp) {
        return #greater;
      };
      if (history1.timestamp > history2.timestamp) {
        return #less;
      };
      Nat.compare(history1.applianceCount, history2.applianceCount);
    };

    public func compareByHouseholdType(history1 : PredictionHistory, history2 : PredictionHistory) : Order.Order {
      Text.compare(history1.householdType, history2.householdType);
    };

    public func compareByPredictedUnits(history1 : PredictionHistory, history2 : PredictionHistory) : Order.Order {
      Float.compare(history1.predictedUnits, history2.predictedUnits);
    };
  };

  let historyMap = Map.empty<Nat, PredictionHistory>();

  var nextId = 0;

  public shared ({ caller }) func addPrediction(history : PredictionHistory) : async Nat {
    let id = nextId;
    let entry : PredictionHistory = {
      history with
      timestamp = Time.now();
    };
    historyMap.add(id, entry);
    nextId += 1;
    id;
  };

  public query ({ caller }) func getAllPredictions() : async [PredictionHistory] {
    if (historyMap.isEmpty()) { Runtime.trap("Data does not exist. ") };
    historyMap.values().toArray().sort();
  };
};
