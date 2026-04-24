-- Powertrain on import estimates (BEV / hybrid / gasoline) for duty-range modeling.
ALTER TABLE "VehicleImportEstimate" ADD COLUMN "engineType" "EngineType";
