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

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to open the firewall port.";
    };
  };

  config = lib.mkIf cfg.enable {
    nixpkgs.overlays = [
      (final: prev: {
        tiyoypdf = final.callPackage ./package.nix { };
      })
    ];

    systemd.services.tiyoypdf = {
      description = "TiyoyPDF PDF Tools";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        TIYOYPDF_PORT = toString cfg.port;
      };

      serviceConfig = {
        ExecStart = "${cfg.package}/bin/tiyoypdf";
        Restart = "on-failure";
        DynamicUser = true;
        RuntimeDirectory = "tiyoypdf";
        StateDirectory = "tiyoypdf";

        # Hardening
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictSUIDSGID = true;
        MemoryDenyWriteExecute = false;
      };
    };

    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}
