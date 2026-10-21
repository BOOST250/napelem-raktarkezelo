<?php

declare(strict_types=1);

namespace Napelem\Support;

use Napelem\Http\ApiException;

/** Bemenet-ellenőrzés. Hiba esetén 400-as ApiExceptiont dob. */
final class Validator
{
    public static function requiredString(array $data, string $key, int $max, string $label): string
    {
        $value = trim((string) ($data[$key] ?? ''));
        if ($value === '') {
            throw new ApiException(400, "Hiányzó kötelező mező: $label.");
        }
        $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
        if ($length > $max) {
            throw new ApiException(400, "A(z) $label legfeljebb $max karakter lehet.");
        }

        return $value;
    }

    public static function optionalString(array $data, string $key, int $max, string $label): ?string
    {
        if (!array_key_exists($key, $data) || $data[$key] === null) {
            return null;
        }
        $value = trim((string) $data[$key]);
        if ($value === '') {
            return null;
        }
        $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
        if ($length > $max) {
            throw new ApiException(400, "A(z) $label legfeljebb $max karakter lehet.");
        }

        return $value;
    }

    public static function int(mixed $value, string $label, int $min, ?int $max = null): int
    {
        if (is_bool($value) || is_array($value) || $value === null || $value === '') {
            throw new ApiException(400, "A(z) $label egész szám kell legyen.");
        }
        if (is_int($value)) {
            $int = $value;
        } elseif (is_float($value)) {
            if (floor($value) !== $value) {
                throw new ApiException(400, "A(z) $label egész szám kell legyen.");
            }
            $int = (int) $value;
        } elseif (is_string($value) && preg_match('/^-?\d+$/', $value) === 1) {
            $int = (int) $value;
        } else {
            throw new ApiException(400, "A(z) $label egész szám kell legyen.");
        }

        if ($int < $min || ($max !== null && $int > $max)) {
            $hatar = $max === null ? "legalább $min" : "$min és $max közötti";
            throw new ApiException(400, "A(z) $label $hatar egész szám kell legyen.");
        }

        return $int;
    }

    public static function money(mixed $value, string $label): float
    {
        if (is_string($value)) {
            $value = str_replace(',', '.', trim($value));
        }
        if (is_bool($value) || is_array($value) || $value === null || $value === ''
            || (!is_int($value) && !is_float($value) && !(is_string($value) && is_numeric($value)))) {
            throw new ApiException(400, "A(z) $label szám kell legyen.");
        }
        $number = round((float) $value, 2);
        if ($number < 0 || $number > 99999999.99) {
            throw new ApiException(400, "A(z) $label nem negatív, legfeljebb 99999999.99 lehet.");
        }

        return $number;
    }

    public static function email(?string $email): ?string
    {
        if ($email === null || $email === '') {
            return null;
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 100) {
            throw new ApiException(400, 'Érvénytelen e-mail cím.');
        }

        return $email;
    }

    public static function phone(?string $phone): ?string
    {
        if ($phone === null || $phone === '') {
            return null;
        }
        if (strlen($phone) > 20 || preg_match('/^[0-9+\\/()\\-\\s]+$/', $phone) !== 1) {
            throw new ApiException(400, 'Érvénytelen telefonszám.');
        }

        return $phone;
    }
}
