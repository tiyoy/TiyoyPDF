{ config, lib, pkgs, ... }:

let
  cfg = config.services.tiyoypdf;
in
{
  options.services.tiyoypdf = {
    enable = lib.mkEnableOption "TiyoyPDF - Professional PDF Tools";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.tiyoypdf;
      defaultText = lib.literalExpression "pkgs.tiyoypdf";
      description = "The TiyoyPDF package to use.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port to listen on.";
    };
  };

  config = lib.mkIf cfg.enable {
    nixpkgs.overlays = [
      (final: prev: {
        tiyoypdf = final.callPackage ./package.nix { };
      })
    ];

    systemd.user.services.tiyoypdf = {
      Unit = {
        Description = "TiyoyPDF PDF Tools";
        After = [ "network.target" ];
      };

      Service = {
        ExecStart = "${cfg.package}/bin/tiyoypdf";
        Restart = "on-failure";
        Environment = [
          "TIYOYPDF_PORT=${toString cfg.port}"
        ];
      };

      Install = {
        WantedBy = [ "default.target" ];
      };
    };
  };
}
