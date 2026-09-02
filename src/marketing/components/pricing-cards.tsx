"use client";

import { buttonVariants } from "@/marketing/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/marketing/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/marketing/components/ui/tooltip";
import { cn, PLANS } from "@/marketing/utils";
import { CheckCircleIcon } from "lucide-react";
import Link from "next/link";

const PricingCards = () => {
  const plan = PLANS[0];

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 pt-6 md:gap-8 lg:grid-cols-3">
      <Card className="flex w-full flex-col rounded-xl border-border lg:col-start-2">
        <CardHeader className="border-b border-border bg-foreground/[0.03]">
          <CardTitle className="text-lg font-medium text-muted-foreground">
            {plan.name}
          </CardTitle>
          <CardDescription>{plan.info}</CardDescription>
          <h5 className="text-3xl font-semibold">${plan.price}</h5>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <p
                      className={cn(
                        feature.tooltip &&
                          "cursor-pointer border-b border-dashed !border-border",
                      )}
                    >
                      {feature.text}
                    </p>
                  </TooltipTrigger>
                  {feature.tooltip ? (
                    <TooltipContent>
                      <p>{feature.tooltip}</p>
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </CardContent>
        <CardFooter className="mt-auto w-full">
          <Link
            href={plan.btn.href}
            style={{ width: "100%" }}
            className={buttonVariants()}
          >
            {plan.btn.text}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PricingCards;
